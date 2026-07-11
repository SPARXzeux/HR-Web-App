"""
One-time migration: creates a dedicated `hr_screenshots` PocketBase collection
for the Screen Tracking feature, replacing the old approach of stuffing
base64-encoded JPEGs into JSON rows inside the generic `hr_delcargo_store`
key/value collection (screenshot_<id> keys).

Why this exists
----------------
Base64-in-JSON works but roughly triples payload size, has no server-side
file handling (no thumbnails, no proper streaming, no MIME validation), and
makes the KV table balloon. A real PocketBase `file` field stores the JPEG
as an actual file on disk/S3 and serves it via `/api/files/...` — smaller
uploads, cheaper reads, and PocketBase-native thumbnail generation.

This script is idempotent: safe to re-run, it skips creation if the
collection already exists.

Usage:
    pip install requests --break-system-packages   # if not already installed
    python migration_data/create_screenshots_collection.py

Old screenshot_* rows in hr_delcargo_store are left untouched by this
script — see MIGRATING_OLD_SCREENSHOTS note at the bottom for the (optional)
one-time backfill.
"""

import json
import sys

import requests

PB_URL = "http://157.230.7.89"
ADMIN_EMAIL = "studiozsparx@gmail.com"
ADMIN_PASSWORD = "Fah123@123"

COLLECTION_NAME = "hr_screenshots"


def get_admin_token():
    resp = requests.post(
        f"{PB_URL}/api/admins/auth-with-password",
        json={"identity": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        timeout=15,
    )
    resp.raise_for_status()
    return resp.json()["token"]


def collection_exists(token, name):
    resp = requests.get(
        f"{PB_URL}/api/collections/{name}",
        headers={"Authorization": f"Bearer {token}"},
        timeout=10,
    )
    return resp.status_code == 200


def create_collection(token):
    schema = [
        {
            "name": "employee_email",
            "type": "text",
            "required": True,
            "unique": False,
            "options": {"min": None, "max": None, "pattern": ""},
        },
        {
            "name": "agent_token",
            "type": "text",
            "required": False,
            "unique": False,
            "options": {"min": None, "max": None, "pattern": ""},
        },
        {
            "name": "device_id",
            "type": "text",
            "required": False,
            "unique": False,
            "options": {"min": None, "max": None, "pattern": ""},
        },
        {
            "name": "device_label",
            "type": "text",
            "required": False,
            "unique": False,
            "options": {"min": None, "max": None, "pattern": ""},
        },
        {
            "name": "captured_at",
            "type": "date",
            "required": True,
            "unique": False,
            "options": {"min": "", "max": ""},
        },
        {
            "name": "image",
            "type": "file",
            "required": True,
            "unique": False,
            "options": {
                "maxSelect": 1,
                "maxSize": 6000000,  # ~6MB safety ceiling per screenshot
                "mimeTypes": ["image/webp", "image/jpeg", "image/png"],
                "thumbs": ["100x75", "320x180"],
                "protected": False,
            },
        },
        {
            "name": "width",
            "type": "number",
            "required": False,
            "unique": False,
            "options": {"min": None, "max": None, "noDecimal": True},
        },
        {
            "name": "height",
            "type": "number",
            "required": False,
            "unique": False,
            "options": {"min": None, "max": None, "noDecimal": True},
        },
    ]

    payload = {
        "name": COLLECTION_NAME,
        "type": "base",
        "schema": schema,
        # Matches this app's current security model: every other hr_ collection
        # is open (no PocketBase auth session exists client-side — see
        # src/lib/db.ts / tracker-agent/README.md caveats). The agent has no
        # session either, so createRule must stay open for uploads to work.
        # updateRule/deleteRule are locked to superuser-only since nothing in
        # the app should ever need to *modify* a screenshot after capture,
        # only create or delete (retention sweep uses the admin API key).
        "listRule": "",
        "viewRule": "",
        "createRule": "",
        "updateRule": None,
        "deleteRule": None,
        "indexes": [
            f"CREATE INDEX idx_{COLLECTION_NAME}_email_captured ON {COLLECTION_NAME} (employee_email, captured_at)"
        ],
    }

    resp = requests.post(
        f"{PB_URL}/api/collections",
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        data=json.dumps(payload),
        timeout=20,
    )
    if resp.status_code >= 300:
        print(f"Failed to create collection: HTTP {resp.status_code}")
        print(resp.text)
        sys.exit(1)
    print(f"Created collection '{COLLECTION_NAME}' successfully.")


def main():
    token = get_admin_token()
    if collection_exists(token, COLLECTION_NAME):
        print(f"Collection '{COLLECTION_NAME}' already exists — nothing to do.")
        return
    create_collection(token)


if __name__ == "__main__":
    main()

# ── MIGRATING_OLD_SCREENSHOTS ────────────────────────────────────────────
# Old screenshots (base64 rows under hr_delcargo_store, key prefix
# "screenshot_") are NOT deleted or moved by this script — they remain
# readable by hrData.ts's legacy fallback (see getScreenshots()) so nothing
# already captured is lost. New captures from the moment the agents are
# updated (see tracker-agent/agent_gui.py / public/delcargo_tracker_agent.py)
# go straight into hr_screenshots as real files. If you want to backfill the
# old rows into hr_screenshots too (so the 30-day retention sweep and ZIP
# export only have to deal with one source), that would be a follow-up
# one-off script decoding each base64 imageData string and POSTing it as a
# multipart file upload — ask for it if/when needed.
