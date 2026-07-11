"""
One-time patch: adds "image/webp" to the allowed mimeTypes on the existing
hr_screenshots collection's `image` file field.

Why this exists
----------------
create_screenshots_collection.py only allowed image/jpeg and image/png when
the collection was first created. The tracker agents (agent_gui.py and
public/delcargo_tracker_agent.py) now capture screenshots as WebP instead
of JPEG (smaller files at equivalent visual quality) — without this patch,
PocketBase would reject new uploads with a mimeType validation error since
your hr_screenshots collection was already created before this change.

Safe to re-run: it's a no-op if image/webp is already in the list.

Usage:
    python migration_data/patch_screenshots_mimetypes.py
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


def main():
    token = get_admin_token()
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

    resp = requests.get(f"{PB_URL}/api/collections/{COLLECTION_NAME}", headers=headers, timeout=10)
    if resp.status_code != 200:
        print(f"Couldn't find collection '{COLLECTION_NAME}' — has create_screenshots_collection.py been run yet?")
        print(resp.text)
        sys.exit(1)

    col = resp.json()
    schema = col.get("schema", [])
    image_field = next((f for f in schema if f["name"] == "image"), None)
    if not image_field:
        print(f"No 'image' field found on {COLLECTION_NAME} — nothing to patch.")
        sys.exit(1)

    mime_types = image_field.get("options", {}).get("mimeTypes", [])
    if "image/webp" in mime_types:
        print("image/webp is already allowed — nothing to do.")
        return

    image_field["options"]["mimeTypes"] = mime_types + ["image/webp"]

    patch_resp = requests.patch(
        f"{PB_URL}/api/collections/{col['id']}",
        headers=headers,
        data=json.dumps({"schema": schema}),
        timeout=20,
    )
    if patch_resp.status_code >= 300:
        print(f"Failed to patch collection: HTTP {patch_resp.status_code}")
        print(patch_resp.text)
        sys.exit(1)

    print("Added image/webp to hr_screenshots' allowed mimeTypes.")


if __name__ == "__main__":
    main()
