#!/usr/bin/env python3
"""
One-time repair: hr_warehouses was migrated into its own PocketBase
collection separately from hr_profiles / hr_teams, so it got brand new
auto-generated record IDs. But hr_profiles.assigned_warehouses,
hr_profiles.managed_warehouses, and hr_teams.warehouse_id still reference
the OLD warehouse IDs (the "wh_<timestamp>" style IDs from
migration_data/warehouses.json). That mismatch is why the app shows a raw
warehouse ID/code instead of the warehouse name — the lookup by ID fails.

This script rebuilds an old-ID -> new-ID map by matching warehouse NAME
(old IDs come from migration_data/warehouses.json, new IDs + names come
from the live hr_warehouses collection), then rewrites every reference it
finds across hr_profiles and hr_teams.

Usage:
    python fix_warehouse_id_mismatch.py --dry-run   # preview only, no writes
    python fix_warehouse_id_mismatch.py             # actually apply fixes
"""
import argparse
import json
import os
import requests

PB_URL = "http://157.230.7.89"
ADMIN_EMAIL = "studiozsparx@gmail.com"
ADMIN_PASS = "Fah123@123"

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
OLD_WAREHOUSES_FILE = os.path.join(SCRIPT_DIR, "warehouses.json")


def auth():
    r = requests.post(f"{PB_URL}/api/admins/auth-with-password",
                       json={"identity": ADMIN_EMAIL, "password": ADMIN_PASS}, timeout=15)
    r.raise_for_status()
    return r.json()["token"]


def hdrs(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def list_all(token, collection):
    items = []
    page = 1
    while True:
        r = requests.get(f"{PB_URL}/api/collections/{collection}/records",
                          params={"page": page, "perPage": 200}, headers=hdrs(token), timeout=20)
        r.raise_for_status()
        data = r.json()
        items.extend(data.get("items", []))
        if page >= data.get("totalPages", 1):
            break
        page += 1
    return items


def patch(token, collection, record_id, fields, dry_run):
    if dry_run:
        print(f"    [dry-run] would PATCH {collection}/{record_id}: {fields}")
        return
    r = requests.patch(f"{PB_URL}/api/collections/{collection}/records/{record_id}",
                        headers=hdrs(token), data=json.dumps(fields), timeout=20)
    if r.status_code not in (200, 201):
        print(f"    [warn] PATCH failed ({r.status_code}) for {collection}/{record_id}: {r.text[:200]}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true", help="Preview without writing")
    args = parser.parse_args()
    dry_run = args.dry_run

    print(f"{'[DRY RUN] ' if dry_run else ''}Connecting to PocketBase...")
    token = auth()
    print("[ok] Authenticated\n")

    # 1. Build old-id -> name map from the pre-migration warehouses.json.
    with open(OLD_WAREHOUSES_FILE, "r", encoding="utf-8") as f:
        old_warehouses = json.load(f)
    old_id_to_name = {w["id"]: w["name"].strip().lower() for w in old_warehouses}
    print(f"Loaded {len(old_id_to_name)} legacy warehouse IDs from warehouses.json")

    # 2. Fetch current hr_warehouses and build name -> new-id map.
    current_warehouses = list_all(token, "hr_warehouses")
    name_to_new_id = {w["name"].strip().lower(): w["id"] for w in current_warehouses}
    print(f"Found {len(current_warehouses)} warehouses currently in hr_warehouses\n")

    # 3. Build old-id -> new-id map via name match.
    old_to_new = {}
    for old_id, name in old_id_to_name.items():
        new_id = name_to_new_id.get(name)
        if new_id and new_id != old_id:
            old_to_new[old_id] = new_id
    if not old_to_new:
        print("No stale ID references found to remap (old and new IDs already match, or no name matches). Nothing to do.")
        return
    print("ID remap table (old -> new):")
    for old_id, new_id in old_to_new.items():
        print(f"  {old_id} -> {new_id}")
    print()

    def remap_list(ids):
        if not isinstance(ids, list):
            return ids, False
        changed = False
        new_list = []
        for i in ids:
            if i in old_to_new:
                new_list.append(old_to_new[i])
                changed = True
            else:
                new_list.append(i)
        return new_list, changed

    # 4. Fix hr_profiles.assigned_warehouses / managed_warehouses.
    profiles = list_all(token, "hr_profiles")
    fixed_profiles = 0
    for p in profiles:
        updates = {}
        aw, aw_changed = remap_list(p.get("assigned_warehouses") or [])
        if aw_changed:
            updates["assigned_warehouses"] = aw
        mw, mw_changed = remap_list(p.get("managed_warehouses") or [])
        if mw_changed:
            updates["managed_warehouses"] = mw
        if updates:
            print(f"  Fixing profile {p.get('full_name', p['id'])} ({p['id']}): {updates}")
            patch(token, "hr_profiles", p["id"], updates, dry_run)
            fixed_profiles += 1
    print(f"\nFixed {fixed_profiles} hr_profiles record(s).\n")

    # 5. Fix hr_teams.warehouse_id.
    teams = list_all(token, "hr_teams")
    fixed_teams = 0
    for t in teams:
        wh_id = t.get("warehouse_id")
        if wh_id in old_to_new:
            new_id = old_to_new[wh_id]
            print(f"  Fixing team {t.get('name', t['id'])} ({t['id']}): warehouse_id {wh_id} -> {new_id}")
            patch(token, "hr_teams", t["id"], {"warehouse_id": new_id}, dry_run)
            fixed_teams += 1
    print(f"\nFixed {fixed_teams} hr_teams record(s).")

    print("\nDone." + (" (dry run — no changes were written)" if dry_run else ""))


if __name__ == "__main__":
    main()
