#!/usr/bin/env python3
"""
One-time migration: promotes data stored as JSON blobs in hr_delcargo_store
(KV store) into the new dedicated PocketBase collections.

Collections targeted:
  hr_timesheets_prod_v1   → hr_timesheets
  hr_tasks_prod_v1        → hr_tasks
  hr_announcements_prod_v1→ hr_announcements
  hr_tickets_prod_v1      → hr_tickets
  hr_payroll_prod_v1      → hr_payroll
  hr_careers_prod_v1      → hr_careers
  hr_career_applications  → hr_career_applications
  hr_teams_prod_v1        → hr_teams

Usage:
    python migrate_kv_to_tables.py
    python migrate_kv_to_tables.py --dry-run   # preview without writing
"""
import argparse
import json
import requests
import sys

PB_URL = "http://157.230.7.89"
ADMIN_EMAIL = "studiozsparx@gmail.com"
ADMIN_PASS = "Fah123@123"

# Keys in hr_delcargo_store → (target_collection, field_name_mapping)
# Field mapping: {kv_field: pb_field}. If None, pass all fields as-is (snake_case from camelCase).
MIGRATIONS = [
    ("hr_timesheets_prod_v1", "hr_timesheets", {
        "employeeEmail": "employee_email",
        "employeeName": "employee_name",
        "clockIn": "clock_in",
        "clockOut": "clock_out",
        "status": "status",
        "date": "date",
        "hoursWorked": "hours_worked",
        "warehouseId": "warehouse_id",
    }),
    ("hr_tasks_prod_v1", "hr_tasks", {
        "title": "title",
        "description": "description",
        "assignedTo": "assigned_to",
        "assignedEmail": "assigned_email",
        "team": "team",
        "dueDate": "due_date",
        "priority": "priority",
        "status": "status",
        "createdBy": "created_by",
    }),
    ("hr_announcements_prod_v1", "hr_announcements", {
        "title": "title",
        "content": "content",
        "author": "author",
        "authorRole": "author_role",
        "pinned": "pinned",
        "targetRole": "target_role",
    }),
    ("hr_tickets_prod_v1", "hr_tickets", {
        "employeeEmail": "employee_email",
        "employeeName": "employee_name",
        "subject": "subject",
        "description": "description",
        "status": "status",
        "priority": "priority",
        "category": "category",
        "assignedTo": "assigned_to",
        "resolution": "resolution",
    }),
    ("hr_payroll_prod_v1", "hr_payroll", {
        "employeeEmail": "employee_email",
        "employeeName": "employee_name",
        "month": "month",
        "year": "year",
        "baseSalary": "base_salary",
        "bonus": "bonus",
        "deductions": "deductions",
        "netPay": "net_pay",
        "status": "status",
        "paidDate": "paid_date",
    }),
    ("hr_careers_prod_v1", "hr_careers", {
        "title": "title",
        "department": "department",
        "location": "location",
        "type": "type",
        "description": "description",
        "requirements": "requirements",
        "status": "status",
        "createdBy": "created_by",
    }),
    ("hr_career_applications_prod_v1", "hr_career_applications", {
        "positionId": "position_id",
        "positionTitle": "position_title",
        "applicantName": "applicant_name",
        "applicantEmail": "applicant_email",
        "phone": "phone",
        "coverLetter": "cover_letter",
        "resumeUrl": "resume_url",
        "status": "status",
        "submittedAt": "submitted_at",
    }),
    ("hr_teams_prod_v1", "hr_teams", {
        "name": "name",
        "leadEmail": "lead_email",
        "members": "members",
        "warehouseId": "warehouse_id",
    }),
]


def auth():
    r = requests.post(f"{PB_URL}/api/admins/auth-with-password",
                      json={"identity": ADMIN_EMAIL, "password": ADMIN_PASS}, timeout=15)
    r.raise_for_status()
    return r.json()["token"]


def hdrs(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def get_kv_row(token, key):
    r = requests.get(
        f"{PB_URL}/api/collections/hr_delcargo_store/records",
        params={"filter": f'(key="{key}")', "perPage": 1},
        headers=hdrs(token), timeout=15
    )
    r.raise_for_status()
    items = r.json().get("items", [])
    if not items:
        return None
    return items[0].get("value")


def collection_count(token, col):
    r = requests.get(f"{PB_URL}/api/collections/{col}/records",
                     params={"perPage": 1}, headers=hdrs(token), timeout=10)
    r.raise_for_status()
    return r.json().get("totalItems", 0)


def migrate_rows(token, rows, target_col, field_map, dry_run):
    inserted = 0
    skipped = 0
    for row in rows:
        if not isinstance(row, dict):
            skipped += 1
            continue
        pb_row = {}
        for kv_field, pb_field in field_map.items():
            val = row.get(kv_field)
            if val is not None:
                pb_row[pb_field] = val
        if not pb_row:
            skipped += 1
            continue
        if dry_run:
            print(f"  [dry-run] Would insert into {target_col}: {list(pb_row.keys())}")
            inserted += 1
            continue
        r = requests.post(
            f"{PB_URL}/api/collections/{target_col}/records",
            headers=hdrs(token), data=json.dumps(pb_row), timeout=20
        )
        if r.status_code in (200, 201):
            inserted += 1
        else:
            print(f"  [warn] Insert failed ({r.status_code}): {r.text[:200]}")
            skipped += 1
    return inserted, skipped


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true", help="Preview without writing")
    args = parser.parse_args()

    print(f"{'[DRY RUN] ' if args.dry_run else ''}Connecting to PocketBase...")
    token = auth()
    print("[ok] Authenticated\n")

    total_inserted = 0
    total_skipped = 0

    for kv_key, target_col, field_map in MIGRATIONS:
        print(f"─── {kv_key} → {target_col} ───")
        value = get_kv_row(token, kv_key)
        if value is None:
            print("  [skip] KV key not found — no data to migrate\n")
            continue
        rows = value if isinstance(value, list) else [value]
        existing = collection_count(token, target_col)
        print(f"  Found {len(rows)} item(s) in KV store. {existing} already in {target_col}.")
        if existing > 0 and not args.dry_run:
            ans = input(f"  {target_col} already has {existing} rows. Add anyway? [y/N] ").strip().lower()
            if ans != "y":
                print("  [skip] Skipped by user\n")
                continue
        ins, skp = migrate_rows(token, rows, target_col, field_map, args.dry_run)
        total_inserted += ins
        total_skipped += skp
        print(f"  Inserted: {ins}, Skipped/errored: {skp}\n")

    print(f"Done. Total inserted: {total_inserted}, skipped: {total_skipped}")


if __name__ == "__main__":
    main()
