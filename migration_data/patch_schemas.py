import json
import requests

PB_URL = "http://157.230.7.89"
token = requests.post(
    f"{PB_URL}/api/admins/auth-with-password",
    json={"identity": "studiozsparx@gmail.com", "password": "Fah123@123"},
    timeout=15,
).json()["token"]
hdrs = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

def patch_collection(name, new_fields):
    r = requests.get(f"{PB_URL}/api/collections/{name}", headers=hdrs, timeout=10)
    col = r.json()
    schema = col.get("schema", [])
    existing_names = {f["name"] for f in schema}
    added = 0
    for field in new_fields:
        if field["name"] not in existing_names:
            schema.append(field)
            added += 1
    if added > 0:
        pr = requests.patch(
            f"{PB_URL}/api/collections/{col['id']}",
            headers=hdrs,
            data=json.dumps({"schema": schema}),
            timeout=20,
        )
        print(f"  {name}: patched {added} field(s) -> HTTP {pr.status_code}")
    else:
        print(f"  {name}: all fields already exist, skipped")

print("Patching hr_tickets: adding 'replies' JSON field...")
patch_collection("hr_tickets", [
    {"system": False, "id": "ti_replies", "name": "replies", "type": "json",
     "required": False, "unique": False, "options": {"maxSize": 5000000}},
])

print("Patching hr_timesheets: adding 'duration' text field...")
patch_collection("hr_timesheets", [
    {"system": False, "id": "ts_duration", "name": "duration", "type": "text",
     "required": False, "unique": False, "options": {"min": None, "max": None, "pattern": ""}},
])

print("Patching hr_announcements: adding missing fields (timestamp, created_by, target)...")
patch_collection("hr_announcements", [
    {"system": False, "id": "an_ts", "name": "timestamp", "type": "text",
     "required": False, "unique": False, "options": {"min": None, "max": None, "pattern": ""}},
    {"system": False, "id": "an_crtby", "name": "created_by", "type": "text",
     "required": False, "unique": False, "options": {"min": None, "max": None, "pattern": ""}},
    {"system": False, "id": "an_target", "name": "target", "type": "text",
     "required": False, "unique": False, "options": {"min": None, "max": None, "pattern": ""}},
])

print("Patching hr_payroll: adding missing fields...")
patch_collection("hr_payroll", [
    {"system": False, "id": "pay_ee_id", "name": "employee_id", "type": "text",
     "required": False, "unique": False, "options": {"min": None, "max": None, "pattern": ""}},
    {"system": False, "id": "pay_name", "name": "employee_name2", "type": "text",  # 'name' is reserved; use employee_name
     "required": False, "unique": False, "options": {"min": None, "max": None, "pattern": ""}},
    {"system": False, "id": "pay_role", "name": "role", "type": "text",
     "required": False, "unique": False, "options": {"min": None, "max": None, "pattern": ""}},
    {"system": False, "id": "pay_region", "name": "region", "type": "text",
     "required": False, "unique": False, "options": {"min": None, "max": None, "pattern": ""}},
    {"system": False, "id": "pay_unpaid", "name": "unpaid_leaves", "type": "number",
     "required": False, "unique": False, "options": {"min": None, "max": None, "noDecimal": False}},
    {"system": False, "id": "pay_proc", "name": "processed", "type": "bool",
     "required": False, "unique": False, "options": {}},
    {"system": False, "id": "pay_incr", "name": "increment_amount", "type": "number",
     "required": False, "unique": False, "options": {"min": None, "max": None, "noDecimal": False}},
])

print("\nDone.")
