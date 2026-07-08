#!/usr/bin/env python3
"""
DelCargo HR — Desktop Screenshot Tracking Agent
================================================

A small, free, cross-platform (Windows/Mac) helper that periodically takes a
screenshot of the desktop and uploads it to the DelCargo HR dashboard, for
employees who have been enabled for remote screen tracking by HR/Admin.

WHY THIS EXISTS
---------------
A web browser tab cannot silently screenshot the whole desktop in the
background — that requires either a real background OS service (this
script) or the Screen Capture API (which needs an open tab, an explicit
share prompt, and a visible "you are sharing your screen" indicator). This
script is the background-service approach.

HOW IT WORKS
------------
1. On each cycle, it asks Supabase (using the same public anon key the web
   app itself uses — there is no separate server here) whether tracking is
   currently enabled for this agent's token, and what interval to use.
2. If enabled, it takes a screenshot, compresses it, and uploads it.
3. It sleeps for the configured interval and repeats.

This is intentionally simple for small-scale testing. It stores images as
base64 rows in Supabase's free-tier database (via the same generic
`delcargo_store` table the web app already uses) rather than a Storage
bucket — fine for a handful of employees over a short test period, but
should move to a real Storage bucket before scaling up.

SETUP
-----
1. Install Python 3.9+ from https://python.org (check "Add to PATH" on Windows).
2. Open a terminal / command prompt in this file's folder and run:
       pip install pyautogui pillow requests --break-system-packages
   (drop --break-system-packages on Windows if it errors)
3. Get your SUPABASE_URL, SUPABASE_ANON_KEY, and AGENT_TOKEN from HR/Admin
   (Screen Tracking page → Setup Agent for your account). Either:
     a) create a file named config.txt next to this script with:
            SUPABASE_URL=...
            SUPABASE_ANON_KEY=...
            AGENT_TOKEN=...
        (one per line, no quotes)
     b) or set them as environment variables before running.
4. Run it:
       python delcargo_tracker_agent.py
   Leave the terminal window open (or set it up to run at login — see
   the bottom of this file for basic autostart notes). It will do nothing
   until HR/Admin flips your tracking toggle to "Active" on the dashboard.

PRIVACY NOTE
------------
This tool takes real screenshots of your screen at the configured interval
while tracking is enabled for your account. Only run this if you have
agreed to this with your employer.
"""

import base64
import io
import json
import os
import platform
import re
import sys
import time
import uuid
from datetime import datetime, timezone

try:
    import requests
except ImportError:
    print("Missing dependency 'requests'. Run: pip install pyautogui pillow requests --break-system-packages")
    sys.exit(1)

try:
    import pyautogui
except ImportError:
    print("Missing dependency 'pyautogui'. Run: pip install pyautogui pillow requests --break-system-packages")
    sys.exit(1)

try:
    from PIL import Image
except ImportError:
    print("Missing dependency 'pillow'. Run: pip install pyautogui pillow requests --break-system-packages")
    sys.exit(1)

CONFIG_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "config.txt")

# Screenshots are resized/compressed before upload to keep them small on the
# Supabase free tier (500MB database limit). Tune these down further if you
# have many employees or a short retention window.
MAX_WIDTH = 1280
JPEG_QUALITY = 45

# How often to re-check whether tracking is still enabled / interval has
# changed, even between capture cycles (in case HR/Admin disables tracking
# mid-cycle — the agent should stop promptly, not keep capturing for a
# potentially long configured interval).
SETTINGS_POLL_SECONDS = 60


def load_config():
    config = {
        "SUPABASE_URL": os.environ.get("SUPABASE_URL", ""),
        "SUPABASE_ANON_KEY": os.environ.get("SUPABASE_ANON_KEY", ""),
        "AGENT_TOKEN": os.environ.get("AGENT_TOKEN", ""),
    }
    if os.path.exists(CONFIG_FILE):
        with open(CONFIG_FILE, "r") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key, _, value = line.partition("=")
                key = key.strip()
                value = value.strip()
                if key in config and value:
                    config[key] = value
    missing = [k for k, v in config.items() if not v]
    if missing:
        print(f"Missing config values: {', '.join(missing)}")
        print(f"Set them in {CONFIG_FILE} or as environment variables. See the setup instructions at the top of this file.")
        sys.exit(1)
    return config


def supabase_headers(anon_key):
    return {
        "apikey": anon_key,
        "Authorization": f"Bearer {anon_key}",
        "Content-Type": "application/json",
    }


def get_tracking_settings(base_url, anon_key, agent_token):
    """Fetch this agent's tracking settings (enabled/interval/employeeEmail)
    by looking up its token inside the hr_tracking_settings_prod_v1 KV row."""
    url = f"{base_url}/rest/v1/delcargo_store?key=eq.hr_tracking_settings_prod_v1&select=value"
    try:
        resp = requests.get(url, headers=supabase_headers(anon_key), timeout=15)
        resp.raise_for_status()
        rows = resp.json()
        if not rows:
            return None
        all_settings = rows[0].get("value") or []
        for s in all_settings:
            if s.get("agentToken") == agent_token:
                return s
        return None
    except Exception as e:
        print(f"[warn] Failed to fetch tracking settings: {e}")
        return None


def heartbeat_key_for(email):
    return "tracker_heartbeat_" + re.sub(r"[^a-z0-9]", "_", (email or "").lower())


def get_device_label():
    try:
        return platform.node() or "Unknown device"
    except Exception:
        return "Unknown device"


def upsert_heartbeat(base_url, anon_key, employee_email, device_id, device_label):
    key = heartbeat_key_for(employee_email)
    now = datetime.now(timezone.utc).isoformat()
    value = {
        "employeeEmail": employee_email,
        "deviceId": device_id,
        "deviceLabel": device_label,
        "connectedAt": now,
        "lastSeenAt": now,
    }
    url = f"{base_url}/rest/v1/delcargo_store"
    payload = {"key": key, "value": value}
    headers = supabase_headers(anon_key)
    headers["Prefer"] = "resolution=merge-duplicates"
    try:
        requests.post(url, headers=headers, data=json.dumps(payload), timeout=20)
    except Exception as e:
        print(f"[warn] Heartbeat failed: {e}")


def check_active_shift(base_url, anon_key, employee_email):
    """Checks the hr_timesheets_prod_v1 table to ensure the employee is on an active shift."""
    if not employee_email:
        return False
    url = f"{base_url}/rest/v1/delcargo_store?key=eq.hr_timesheets_prod_v1&select=value"
    try:
        resp = requests.get(url, headers=supabase_headers(anon_key), timeout=15)
        resp.raise_for_status()
        rows = resp.json()
        if not rows:
            return False
        timesheets = rows[0].get("value") or []
        for t in timesheets:
            if t.get("employeeEmail", "").lower() == employee_email.lower() and t.get("status") == "in_progress":
                return True
    except Exception as e:
        print(f"[warn] Shift check failed: {e}")
    return False


def capture_and_encode():
    img = pyautogui.screenshot()
    w, h = img.size
    if w > MAX_WIDTH:
        new_h = int(h * (MAX_WIDTH / w))
        img = img.resize((MAX_WIDTH, new_h), Image.LANCZOS)
    buf = io.BytesIO()
    img.convert("RGB").save(buf, format="JPEG", quality=JPEG_QUALITY)
    b64 = base64.b64encode(buf.getvalue()).decode("ascii")
    return f"data:image/jpeg;base64,{b64}"


def upload_screenshot(base_url, anon_key, employee_email, image_data_url):
    shot_id = f"scr_{int(time.time() * 1000)}_{uuid.uuid4().hex[:6]}"
    timestamp = datetime.now(timezone.utc).isoformat()
    value = {
        "id": shot_id,
        "employeeEmail": employee_email,
        "timestamp": timestamp,
        "imageData": image_data_url,
    }
    url = f"{base_url}/rest/v1/delcargo_store"
    payload = {"key": f"screenshot_{shot_id}", "value": value}
    headers = supabase_headers(anon_key)
    headers["Prefer"] = "resolution=merge-duplicates"
    try:
        resp = requests.post(url, headers=headers, data=json.dumps(payload), timeout=20)
        if resp.status_code >= 300:
            print(f"[warn] Upload failed ({resp.status_code}): {resp.text[:200]}")
            return False
        print(f"[ok] Uploaded screenshot at {timestamp}")
        return True
    except Exception as e:
        print(f"[warn] Upload error: {e}")
        return False


def main():
    config = load_config()
    base_url = config["SUPABASE_URL"].rstrip("/")
    anon_key = config["SUPABASE_ANON_KEY"]
    agent_token = config["AGENT_TOKEN"]
    device_id = uuid.uuid4().hex
    device_label = get_device_label()

    print("DelCargo HR tracking agent starting. Waiting for tracking to be enabled by HR/Admin...")

    while True:
        settings = get_tracking_settings(base_url, anon_key, agent_token)

        if settings is None:
            print("[warn] Could not find tracking settings for this token. Check your config and ask HR/Admin to confirm setup. Retrying in 60s.")
            time.sleep(SETTINGS_POLL_SECONDS)
            continue

        if not settings.get("enabled"):
            time.sleep(SETTINGS_POLL_SECONDS)
            continue

        employee_email = settings.get("employeeEmail")
        upsert_heartbeat(base_url, anon_key, employee_email, device_id, device_label)

        if not check_active_shift(base_url, anon_key, employee_email):
            time.sleep(SETTINGS_POLL_SECONDS)
            continue

        employee_email = settings.get("employeeEmail")
        interval_minutes = max(0.1, float(settings.get("intervalMinutes", 15)))

        try:
            image_data_url = capture_and_encode()
            upload_screenshot(base_url, anon_key, employee_email, image_data_url)
        except Exception as e:
            print(f"[warn] Capture failed: {e}")

        # Sleep in short chunks so a mid-interval "disable tracking" from
        # HR/Admin is noticed promptly rather than waiting out the full
        # (possibly long) interval.
        remaining = interval_minutes * 60
        while remaining > 0:
            chunk = min(SETTINGS_POLL_SECONDS, remaining)
            time.sleep(chunk)
            remaining -= chunk


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nStopped.")

# ── Optional: run automatically at login ──────────────────────────────────
# Windows: create a shortcut to this script in
#   shell:startup  (Win+R, type shell:startup, Enter)
# using a target like:
#   pythonw.exe "C:\path\to\delcargo_tracker_agent.py"
#
# macOS: create ~/Library/LaunchAgents/com.delcargo.tracker.plist that runs
#   /usr/bin/python3 /path/to/delcargo_tracker_agent.py
# and load it with: launchctl load ~/Library/LaunchAgents/com.delcargo.tracker.plist
