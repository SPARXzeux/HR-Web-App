"""
One-time migration: creates a dedicated `hr_inactivity_logs` PocketBase
collection for the mouse-inactivity tracking feature.

Why a real collection instead of hr_delcargo_store (KV)
---------------------------------------------------------
Same reasoning as hr_screenshots (see create_screenshots_collection.py):
KV rows have no server-side date-range filtering, so every read would have
to fetch the *entire* prefix and filter client-side. Inactivity events are
short and frequent (every idle stretch >= 3 minutes, potentially many per
shift, across months), so this would only get slower over time. A real
collection with start_at/end_at fields lets HR/Admin's Daily/Weekly/Monthly
filters run as indexed server-side queries instead.

This script is idempotent: safe to re-run, it skips creation if the
collection already exists.

Usage:
    pip install requests --break-system-packages   # if not already installed
    python migration_data/create_inactivity_logs_collection.py
"""

import json
import sys

import requests

PB_URL = "http://157.230.7.89"
ADMIN_EMAIL = "studiozsparx@gmail.com"
ADMIN_PASSWORD = "Fah123@123"

COLLECTION_NAME = "hr_inactivity_logs"


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
            "name": "start_at",
            "type": "date",
            "required": True,
            "unique": False,
            "options": {"min": "", "max": ""},
        },
        {
            "name": "end_at",
            "type": "date",
            "required": True,
            "unique": False,
            "options": {"min": "", "max": ""},
        },
        {
            "name": "duration_seconds",
            "type": "number",
            "required": True,
            "unique": False,
            "options": {"min": 0, "max": None, "noDecimal": True},
        },
    ]

    payload = {
        "name": COLLECTION_NAME,
        "type": "base",
        "schema": schema,
        # Matches hr_screenshots' security model — see the note in
        # create_screenshots_collection.py. The agent has no auth session, so
        # createRule must stay open for uploads to work. updateRule/deleteRule
        # are locked to superuser-only since nothing in the app should ever
        # need to *edit* a logged interval after the fact, only create it (or
        # delete it via a future retention sweep, if one is added later).
        "listRule": "",
        "viewRule": "",
        "createRule": "",
        "updateRule": None,
        "deleteRule": None,
        "indexes": [
            f"CREATE INDEX idx_{COLLECTION_NAME}_email_start ON {COLLECTION_NAME} (employee_email, start_at)"
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
