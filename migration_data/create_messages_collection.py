"""
One-time migration: creates a dedicated `hr_messages` PocketBase collection
for the Team Chat feature (WhatsApp-style team channels, one channel per
hr_teams row — no DMs).

Why a real collection with a real file field
----------------------------------------------
Same reasoning as hr_screenshots (see create_screenshots_collection.py):
base64-in-JSON via hr_delcargo_store would triple attachment payload size
and give no server-side pagination/filtering. Chat messages are frequent
and need to load "latest N for this team" fast, and attachments (images,
PDFs, docs) need real file storage, not JSON blobs.

Security note (matches the rest of this app's current, deliberate posture)
----------------------------------------------------------------------------
listRule/viewRule/createRule are left open, same as every other hr_
collection right now — there is no PocketBase auth session on the client
(see SCHEMA_REFERENCE.md / HANDOFF_NOTES.md). That means team-scoping
("only this team's members can read/post") and "Admin can see every team's
chat" are enforced in the UI (src/lib/hrData.ts + the Team Chat pages), not
by the database. The user has explicitly said this is fine for now and will
be tightened when the app moves to a real production/deployment phase with
PocketBase auth turned on — don't quietly "fix" this without asking first.

This script is idempotent: safe to re-run any time. If the collection
doesn't exist yet, it creates it with the full schema below. If it already
exists, it instead adds any fields that are missing (e.g. after this file
gets a new field added to it later) and leaves everything else alone.

Usage:
    pip install requests --break-system-packages   # if not already installed
    python migration_data/create_messages_collection.py
"""

import json
import sys

import requests

PB_URL = "http://157.230.7.89"
ADMIN_EMAIL = "studiozsparx@gmail.com"
ADMIN_PASSWORD = "Fah123@123"

COLLECTION_NAME = "hr_messages"


def get_admin_token():
    resp = requests.post(
        f"{PB_URL}/api/admins/auth-with-password",
        json={"identity": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        timeout=15,
    )
    resp.raise_for_status()
    return resp.json()["token"]


def get_collection(token, name):
    resp = requests.get(
        f"{PB_URL}/api/collections/{name}",
        headers={"Authorization": f"Bearer {token}"},
        timeout=10,
    )
    if resp.status_code == 200:
        return resp.json()
    return None


def build_schema():
    return [
        {
            # hr_teams.id this message belongs to. One chat channel per team,
            # membership resolved client-side from hr_teams.members.
            "name": "team_id",
            "type": "text",
            "required": True,
            "unique": False,
            "options": {"min": None, "max": None, "pattern": ""},
        },
        {
            "name": "sender_email",
            "type": "text",
            "required": True,
            "unique": False,
            "options": {"min": None, "max": None, "pattern": ""},
        },
        {
            # Real name, snapshotted at send time — used for the HR/Admin
            # oversight view (which always shows real names). Regular team
            # members/leads never see this field rendered directly; the UI
            # resolves sender_email -> displayName(profile, viewerRole)
            # instead so a later Alias change also applies to old messages.
            "name": "sender_name",
            "type": "text",
            "required": True,
            "unique": False,
            "options": {"min": None, "max": None, "pattern": ""},
        },
        {
            "name": "text",
            "type": "text",
            "required": False,
            "unique": False,
            "options": {"min": None, "max": 4000, "pattern": ""},
        },
        {
            "name": "attachment",
            "type": "file",
            "required": False,
            "unique": False,
            "options": {
                "maxSelect": 1,
                "maxSize": 15000000,  # ~15MB cap per file
                "mimeTypes": [
                    "image/png", "image/jpeg", "image/webp", "image/gif",
                    "application/pdf",
                    "application/msword",
                    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                    "application/vnd.ms-excel",
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    "application/zip",
                    "text/plain",
                ],
                "thumbs": ["100x100"],
                "protected": False,
            },
        },
        {
            # PocketBase file fields store a system-generated filename;
            # this keeps the original name so the chat UI can show/download
            # it with a human-readable label.
            "name": "attachment_name",
            "type": "text",
            "required": False,
            "unique": False,
            "options": {"min": None, "max": None, "pattern": ""},
        },
        {
            # Raw byte size at upload time (from the browser File object),
            # captured so the chat's "filter by size" control can filter
            # without a HEAD request per attachment.
            "name": "attachment_size",
            "type": "number",
            "required": False,
            "unique": False,
            "options": {"min": 0, "max": None, "noDecimal": True},
        },
        {
            # Marks a message as a pinned Announcement (see TeamChatView's
            # announcement banner/composer toggle) vs. a regular chat
            # message. Anyone who can post in a channel can send one.
            "name": "is_announcement",
            "type": "bool",
            "required": False,
            "unique": False,
            "options": {},
        },
    ]


def create_collection(token):
    payload = {
        "name": COLLECTION_NAME,
        "type": "base",
        "schema": build_schema(),
        "listRule": "",
        "viewRule": "",
        "createRule": "",
        # No client-side edit/delete of messages for now — keeps the audit
        # trail (including for Admin oversight) simple and tamper-free.
        "updateRule": None,
        "deleteRule": None,
        "indexes": [
            f"CREATE INDEX idx_{COLLECTION_NAME}_team_created ON {COLLECTION_NAME} (team_id, created)"
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


def sync_missing_fields(token, existing):
    """Adds any fields from build_schema() that aren't already present on
    an existing hr_messages collection. Lets this same script double as a
    schema-upgrade tool when new fields (like attachment_size /
    is_announcement) get added later, without needing a second script or
    a manual trip into the PocketBase admin UI."""
    existing_names = {f["name"] for f in existing.get("schema", [])}
    missing = [f for f in build_schema() if f["name"] not in existing_names]
    if not missing:
        print(f"Collection '{COLLECTION_NAME}' already has all expected fields — nothing to do.")
        return

    payload = dict(existing)
    payload["schema"] = existing["schema"] + missing
    resp = requests.patch(
        f"{PB_URL}/api/collections/{existing['id']}",
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        data=json.dumps(payload),
        timeout=20,
    )
    if resp.status_code >= 300:
        print(f"Failed to update collection: HTTP {resp.status_code}")
        print(resp.text)
        sys.exit(1)
    added = ", ".join(f["name"] for f in missing)
    print(f"Added missing field(s) to '{COLLECTION_NAME}': {added}")


def main():
    token = get_admin_token()
    existing = get_collection(token, COLLECTION_NAME)
    if existing:
        sync_missing_fields(token, existing)
        return
    create_collection(token)


if __name__ == "__main__":
    main()
