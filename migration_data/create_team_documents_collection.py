"""
One-time migration: creates a dedicated `hr_team_documents` PocketBase
collection for the new Team Documents feature — a per-team document/video/
image library, shown alongside Team Chat, that Admin/HR/Team Lead can upload
to and every team member (including newly-added ones) can view.

Why a real collection with a real file field
----------------------------------------------
Same reasoning as hr_messages/hr_screenshots: base64-in-JSON via
hr_delcargo_store would bloat payloads and give no server-side
pagination/filtering, and these files (onboarding PDFs, instructional
videos, images) need real file storage, not JSON blobs. maxSize is larger
than hr_messages' attachment cap (15MB) specifically to accommodate short
instructional videos.

Security note (matches the rest of this app's current, deliberate posture)
----------------------------------------------------------------------------
listRule/viewRule/createRule/deleteRule are left open, same as every other
hr_ collection right now — there is no PocketBase auth session on the
client (see SCHEMA_REFERENCE.md / HANDOFF_NOTES.md). That means team-
scoping ("only this team's members can view", "only Admin/HR/Team Lead can
upload/delete") is enforced in the UI (src/lib/hrData.ts +
TeamDocumentsPanel.tsx), not by the database. The user has explicitly said
this is fine for now and will be tightened when the app moves to a real
production/deployment phase with PocketBase auth turned on — don't quietly
"fix" this without asking first.

This script is idempotent: safe to re-run any time. If the collection
doesn't exist yet, it creates it with the full schema below. If it already
exists, it instead adds any fields that are missing and leaves everything
else alone.

Usage:
    pip install requests --break-system-packages   # if not already installed
    python migration_data/create_team_documents_collection.py
"""

import json
import sys

import requests

PB_URL = "http://157.230.7.89"
ADMIN_EMAIL = "studiozsparx@gmail.com"
ADMIN_PASSWORD = "Fah123@123"

COLLECTION_NAME = "hr_team_documents"


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
            # hr_teams.id this document belongs to. Every team has its own
            # separate document library, resolved client-side the same way
            # Team Chat channels are.
            "name": "team_id",
            "type": "text",
            "required": True,
            "unique": False,
            "options": {"min": None, "max": None, "pattern": ""},
        },
        {
            # Short human title, e.g. "Warehouse Onboarding Guide" — shown
            # in the document list and used as the tag label when someone
            # references this doc in chat (see the "#" tag picker).
            "name": "title",
            "type": "text",
            "required": True,
            "unique": False,
            "options": {"min": None, "max": 150, "pattern": ""},
        },
        {
            "name": "description",
            "type": "text",
            "required": False,
            "unique": False,
            "options": {"min": None, "max": 1000, "pattern": ""},
        },
        {
            "name": "file",
            "type": "file",
            "required": True,
            "unique": False,
            "options": {
                "maxSelect": 1,
                "maxSize": 100000000,  # ~100MB cap — large enough for short instructional videos
                "mimeTypes": [
                    "image/png", "image/jpeg", "image/webp", "image/gif",
                    "application/pdf",
                    "application/msword",
                    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                    "application/vnd.ms-excel",
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    "application/vnd.ms-powerpoint",
                    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
                    "application/zip",
                    "text/plain",
                    "video/mp4",
                    "video/webm",
                    "video/quicktime",
                ],
                "thumbs": ["200x200"],
                "protected": False,
            },
        },
        {
            # Original filename — PocketBase renames the stored file, so
            # this keeps the human-readable name for display/download.
            "name": "file_name",
            "type": "text",
            "required": False,
            "unique": False,
            "options": {"min": None, "max": None, "pattern": ""},
        },
        {
            "name": "file_size",
            "type": "number",
            "required": False,
            "unique": False,
            "options": {"min": 0, "max": None, "noDecimal": True},
        },
        {
            "name": "uploaded_by_email",
            "type": "text",
            "required": True,
            "unique": False,
            "options": {"min": None, "max": None, "pattern": ""},
        },
        {
            # Real name, snapshotted at upload time — same pattern as
            # hr_messages.sender_name. Regular UI resolves the uploader's
            # live displayName(profile, viewerRole) instead so a later
            # Alias change applies retroactively; this is just the fallback
            # for when the uploader's profile no longer exists.
            "name": "uploaded_by_name",
            "type": "text",
            "required": True,
            "unique": False,
            "options": {"min": None, "max": None, "pattern": ""},
        },
        {
            "name": "uploaded_by_role",
            "type": "text",
            "required": False,
            "unique": False,
            "options": {"min": None, "max": None, "pattern": ""},
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
        # Open, UI-enforced (Admin/HR/Team Lead only) — documents can be
        # removed when outdated, unlike hr_messages which has no delete.
        "updateRule": "",
        "deleteRule": "",
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
    """Adds any fields from build_schema() that aren't already present on an
    existing hr_team_documents collection, so this same script can double as
    a schema-upgrade tool later."""
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
