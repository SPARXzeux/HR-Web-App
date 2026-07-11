#!/usr/bin/env python3
"""
DelCargo Tracker — Desktop Screenshot Tracking Agent (GUI edition)
====================================================================

A small, professional-looking desktop app for Windows and Mac that
periodically captures a screenshot and uploads it to the DelCargo HR
dashboard, for employees who have been enabled for remote screen tracking
by HR/Admin. This is the packaged/GUI version of the plain
`delcargo_tracker_agent.py` script — same capture/upload logic, but with:

  - A one-time setup screen: paste a single setup code from the HR/Admin
    "Setup Agent" dialog (no manually copying URLs/tokens into a text file).
  - A system tray / menu-bar icon so it runs quietly in the background.
  - Optional "start automatically when I log in" (Windows + macOS).
  - A status window showing connection state, tracking on/off, and the
    last capture time — instead of a bare terminal.

WHY THIS EXISTS
---------------
A web browser tab cannot silently screenshot the whole desktop in the
background — that requires either a real background OS service (this app)
or the browser's Screen Capture API (which needs an open tab, an explicit
share prompt, and a visible "you are sharing your screen" indicator).

HOW IT WORKS
------------
1. On first launch, the employee pastes a one-time setup code (from HR/
   Admin's Screen Tracking → Setup Agent screen) into this app.
2. The app decodes the code into a PocketBase URL and agent token,
   confirms it can find a matching tracking-settings row, and saves it
   locally (never re-asks unless "Disconnect" or "Use a Different Setup
   Code" is used from the dashboard).
3. In the background, it polls PocketBase every ~60s to check whether
   tracking is currently enabled for this token and what interval to use.
4. If enabled, it takes a screenshot, compresses it, and uploads it, then
   waits out the configured interval (checking for a "disable" in between).

Images are uploaded as real files into the dedicated `hr_screenshots`
PocketBase collection (see migration_data/create_screenshots_collection.py),
not embedded as base64 JSON rows — smaller uploads, and the dashboard can
serve/thumbnail them natively.

This file is meant to be packaged into a standalone .exe (Windows) / .app
or binary (macOS) with PyInstaller — see build_windows.bat / build_mac.sh
in this same folder — so employees never need to install Python themselves.
"""

import base64
import binascii
import io
import json
import os
import platform
import re
import sys
import threading
import time
import uuid
from datetime import datetime, timedelta, timezone

import tkinter as tk
from tkinter import ttk, messagebox

try:
    import requests
except ImportError:
    print("Missing dependency 'requests'. Run: pip install -r requirements.txt")
    sys.exit(1)

try:
    import pyautogui
except ImportError:
    print("Missing dependency 'pyautogui'. Run: pip install -r requirements.txt")
    sys.exit(1)

from PIL import Image, ImageDraw

try:
    import pystray
except ImportError:
    pystray = None  # Tray icon becomes optional; app still runs as a normal window.

APP_NAME = "DelCargo Tracker"
APP_DIR = os.path.join(os.path.expanduser("~"), ".delcargo_tracker")
CONFIG_FILE = os.path.join(APP_DIR, "config.json")

MAX_WIDTH = 1280
WEBP_QUALITY = 80  # WebP at 80 looks visually equivalent to (often better than) JPEG
                   # at much higher settings, while producing a smaller file
SETTINGS_POLL_SECONDS = 20  # how often we re-check tracking/shift status (was 60s — this is how
                            # quickly the app notices you clocked in and flips to "Tracking Active")

MOUSE_POLL_SECONDS = 5       # how often we sample the cursor position
INACTIVITY_THRESHOLD_SECONDS = 180  # 3 minutes — matches the HR/Admin-facing spec

# ── Brand palette — kept in lockstep with the web dashboard's Tailwind
# tokens (src/app/globals.css / the orange-600 accent used throughout
# Sidebar.tsx, TopNav.tsx, Badge.tsx) so the desktop app reads as the same
# product, not a bolted-on utility.
ACCENT = "#ea580c"        # orange-600 — primary buttons, active states
ACCENT_HOVER = "#c2410c"  # orange-700 — hover/active press state
ACCENT_SOFT = "#fff7ed"   # orange-50  — soft badge/callout backgrounds
INK = "#1e293b"           # slate-800  — headings / primary text
MUTED = "#64748b"         # slate-500  — secondary text
BORDER = "#e2e8f0"        # slate-200  — card/input borders
BG = "#f8fafc"            # slate-50   — app background
CARD_BG = "#ffffff"
SUCCESS = "#10b981"       # emerald-500 — "Active"/"Connected" states
SUCCESS_SOFT = "#ecfdf5"  # emerald-50
WARNING = "#f59e0b"       # amber-500 — "Paused" state
WARNING_SOFT = "#fffbeb"  # amber-50
DANGER = "#e11d48"        # rose-600 — errors / disconnect
DANGER_SOFT = "#fff1f2"   # rose-50


def _font_family():
    """Closest system-native equivalent to the web dashboard's default UI
    font on each OS — Segoe UI on Windows, San Francisco (via the Helvetica
    Neue alias Tk resolves to SF on modern macOS) on Mac."""
    return "SF Pro Text" if platform.system() == "Darwin" else "Segoe UI"


FONT = _font_family()


def _round_rect(canvas, x1, y1, x2, y2, radius=12, **kwargs):
    """Draws a filled rounded rectangle on a Tk Canvas (Tkinter has no
    native rounded-rect primitive) — used everywhere the web app uses
    Tailwind's rounded-xl/rounded-2xl cards, pills, and buttons."""
    points = [
        x1 + radius, y1,
        x2 - radius, y1,
        x2, y1,
        x2, y1 + radius,
        x2, y2 - radius,
        x2, y2,
        x2 - radius, y2,
        x1 + radius, y2,
        x1, y2,
        x1, y2 - radius,
        x1, y1 + radius,
        x1, y1,
    ]
    return canvas.create_polygon(points, smooth=True, **kwargs)


class Card(tk.Frame):
    """A white, rounded, bordered container — the desktop equivalent of the
    web app's <Card> component (rounded-2xl, border-slate-200, bg-white)."""

    def __init__(self, parent, padding=16, radius=14, **kwargs):
        super().__init__(parent, bg=BG, highlightthickness=0, **kwargs)
        self._canvas = tk.Canvas(self, bg=BG, highlightthickness=0, bd=0)
        self._canvas.pack(fill="both", expand=True)
        self.inner = tk.Frame(self._canvas, bg=CARD_BG)
        self._radius = radius
        self._padding = padding
        self._win = self._canvas.create_window(0, 0, window=self.inner, anchor="nw")
        self.inner.bind("<Configure>", self._on_inner_configure)
        self._canvas.bind("<Configure>", self._on_canvas_configure)

    def _on_inner_configure(self, _evt=None):
        w = self.inner.winfo_reqwidth() + self._padding * 2
        h = self.inner.winfo_reqheight() + self._padding * 2
        self._canvas.configure(width=w, height=h)
        self._redraw(w, h)

    def _on_canvas_configure(self, evt):
        self._redraw(evt.width, evt.height)
        self._canvas.itemconfig(self._win, width=max(0, evt.width - self._padding * 2))

    def _redraw(self, w, h):
        self._canvas.delete("bg")
        if w > 2 and h > 2:
            _round_rect(self._canvas, 1, 1, w - 1, h - 1, radius=self._radius,
                         fill=CARD_BG, outline=BORDER, width=1, tags="bg")
            self._canvas.tag_lower("bg")
        self._canvas.coords(self._win, self._padding, self._padding)


class PillButton(tk.Canvas):
    """A pill/rounded button matching the web app's button styling — Tk's
    stock ttk.Button can't do rounded corners or a true brand-orange fill
    reliably across platforms, so this draws its own."""

    VARIANTS = {
        "primary": dict(bg=ACCENT, hover=ACCENT_HOVER, fg="white"),
        "secondary": dict(bg="#f1f5f9", hover="#e2e8f0", fg=INK),
        "danger": dict(bg=DANGER_SOFT, hover="#ffe4e6", fg=DANGER),
    }

    def __init__(self, parent, text, command=None, variant="primary", width=None, height=38, font_size=10, **kwargs):
        super().__init__(parent, height=height, highlightthickness=0, bd=0, bg=BG, **kwargs)
        self.command = command
        self.text = text
        self.colors = self.VARIANTS.get(variant, self.VARIANTS["primary"])
        self._hovering = False
        self._min_width = width
        self._height = height
        self.font = (FONT, font_size, "bold")
        self.bind("<Configure>", lambda e: self._draw())
        self.bind("<Button-1>", self._on_click)
        self.bind("<Enter>", lambda e: self._set_hover(True))
        self.bind("<Leave>", lambda e: self._set_hover(False))
        self.configure(cursor="hand2")
        if width:
            self.configure(width=width)
        self.after(10, self._draw)

    def set_text(self, text):
        self.text = text
        self._draw()

    def set_enabled(self, enabled):
        self.command_enabled = enabled
        self._draw()

    def _set_hover(self, state):
        self._hovering = state
        self._draw()

    def _on_click(self, _evt):
        if self.command:
            self.command()

    def _draw(self):
        self.delete("all")
        w = self.winfo_width() or self._min_width or 140
        h = self.winfo_height() or self._height
        fill = self.colors["hover"] if self._hovering else self.colors["bg"]
        _round_rect(self, 1, 1, max(w - 1, 20), h - 1, radius=h / 2, fill=fill, outline="")
        self.create_text(w / 2, h / 2, text=self.text, fill=self.colors["fg"], font=self.font)


def badge(parent, text, variant="default"):
    """Small rounded status pill matching the web app's <Badge> component."""
    colors = {
        "success": (SUCCESS_SOFT, SUCCESS),
        "warning": (WARNING_SOFT, "#b45309"),
        "danger": (DANGER_SOFT, DANGER),
        "default": ("#f1f5f9", MUTED),
    }
    bg_c, fg_c = colors.get(variant, colors["default"])
    c = tk.Canvas(parent, height=22, highlightthickness=0, bd=0, bg=parent["bg"] if "bg" in parent.keys() else BG)
    f = (FONT, 8, "bold")
    tmp = tk.Label(parent, text=text, font=f)
    tmp.update_idletasks()
    tw = tmp.winfo_reqwidth() + 20
    tmp.destroy()
    c.configure(width=tw)
    c.after(10, lambda: (_round_rect(c, 0, 0, tw, 22, radius=11, fill=bg_c, outline=""),
                          c.create_text(tw / 2, 11, text=text.upper(), fill=fg_c, font=f)))
    return c


# ─────────────────────────── setup code helpers ────────────────────────────

def encode_setup_code(url, token):
    """Encodes url + agent token into a base64url setup code (no API key needed)."""
    payload = json.dumps({"u": url, "t": token}).encode("utf-8")
    return base64.urlsafe_b64encode(payload).decode("ascii")


def decode_setup_code(code):
    code = (code or "").strip()
    # Tolerate accidental whitespace/newlines from copy-paste.
    code = "".join(code.split())
    padded = code + "=" * (-len(code) % 4)
    data = base64.urlsafe_b64decode(padded.encode("ascii"))
    obj = json.loads(data.decode("utf-8"))
    url, token = obj.get("u"), obj.get("t")
    # Back-compat: old codes had a 'k' (anon key) field — ignore it.
    if not (url and token):
        raise ValueError("Setup code is missing required fields.")
    return url.rstrip("/"), token


# ─────────────────────────── local config storage ───────────────────────────

def load_config():
    if not os.path.exists(CONFIG_FILE):
        return None
    try:
        with open(CONFIG_FILE, "r") as f:
            return json.load(f)
    except Exception:
        return None


def save_config(cfg):
    os.makedirs(APP_DIR, exist_ok=True)
    with open(CONFIG_FILE, "w") as f:
        json.dump(cfg, f)


def clear_config():
    try:
        os.remove(CONFIG_FILE)
    except OSError:
        pass


# ───────────────────────────── autostart helpers ────────────────────────────

def _current_executable():
    """Path to launch on login. When frozen by PyInstaller, sys.executable
    is the standalone app itself; otherwise fall back to the python
    interpreter + this script (dev mode)."""
    if getattr(sys, "frozen", False):
        return f'"{sys.executable}"'
    return f'"{sys.executable}" "{os.path.abspath(__file__)}"'


def set_autostart(enabled):
    system = platform.system()
    try:
        if system == "Windows":
            import winreg
            key_path = r"Software\Microsoft\Windows\CurrentVersion\Run"
            with winreg.OpenKey(winreg.HKEY_CURRENT_USER, key_path, 0, winreg.KEY_SET_VALUE) as key:
                if enabled:
                    winreg.SetValueEx(key, "DelCargoTracker", 0, winreg.REG_SZ, _current_executable())
                else:
                    try:
                        winreg.DeleteValue(key, "DelCargoTracker")
                    except FileNotFoundError:
                        pass
        elif system == "Darwin":
            plist_path = os.path.join(
                os.path.expanduser("~"), "Library", "LaunchAgents", "com.delcargo.tracker.plist"
            )
            if enabled:
                exe = sys.executable if getattr(sys, "frozen", False) else sys.executable
                args = [exe] if getattr(sys, "frozen", False) else [exe, os.path.abspath(__file__)]
                arg_xml = "\n        ".join(f"<string>{a}</string>" for a in args)
                plist = f"""<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.delcargo.tracker</string>
    <key>ProgramArguments</key>
    <array>
        {arg_xml}
    </array>
    <key>RunAtLoad</key>
    <true/>
</dict>
</plist>
"""
                os.makedirs(os.path.dirname(plist_path), exist_ok=True)
                with open(plist_path, "w") as f:
                    f.write(plist)
                os.system(f'launchctl load "{plist_path}" >/dev/null 2>&1')
            else:
                os.system(f'launchctl unload "{plist_path}" >/dev/null 2>&1')
                try:
                    os.remove(plist_path)
                except OSError:
                    pass
        # Other platforms: no-op (Linux desktop-entry autostart intentionally
        # left out — this agent targets Windows/Mac employee machines).
    except Exception as e:
        print(f"[warn] Could not set autostart: {e}")


# ── PocketBase REST helpers ───────────────────────────────────────────────────
# PocketBase public (open-rule) collections need no auth header.
# All reads use filter params; upserts do GET-then-PATCH-or-POST.

PB_COLLECTION = "hr_delcargo_store"
JSON_HEADERS = {"Content-Type": "application/json"}


def pb_get_kv(base_url, key):
    """Fetch a single key from hr_delcargo_store. Returns (record_id, value) or (None, None)."""
    url = f"{base_url}/api/collections/{PB_COLLECTION}/records"
    params = {"filter": f'(key="{key}")', "perPage": 1}
    resp = requests.get(url, params=params, timeout=15)
    resp.raise_for_status()
    items = resp.json().get("items", [])
    if not items:
        return None, None
    row = items[0]
    return row.get("id"), row.get("value")


def pb_set_kv(base_url, key, value):
    """Upsert a key/value pair in hr_delcargo_store."""
    record_id, _ = pb_get_kv(base_url, key)
    payload = json.dumps({"key": key, "value": value})
    if record_id:
        url = f"{base_url}/api/collections/{PB_COLLECTION}/records/{record_id}"
        resp = requests.patch(url, headers=JSON_HEADERS, data=payload, timeout=20)
    else:
        url = f"{base_url}/api/collections/{PB_COLLECTION}/records"
        resp = requests.post(url, headers=JSON_HEADERS, data=payload, timeout=20)
    resp.raise_for_status()


def supabase_headers(anon_key):  # kept as alias so old configs don't break
    return JSON_HEADERS


def get_tracking_settings(base_url, _unused_key, agent_token):
    """Fetch this agent's tracking settings by looking up its token in the KV store."""
    _, value = pb_get_kv(base_url, "hr_tracking_settings_prod_v1")
    if value is None:
        return None
    all_settings = value if isinstance(value, list) else []
    for s in all_settings:
        if s.get("agentToken") == agent_token:
            return s
    return None


def check_active_shift(base_url, _unused_key, employee_email):
    """Checks the real hr_timesheets collection for an open shift for this
    employee. IMPORTANT: hr_timesheets has no literal "in_progress" status
    value — its fixed status enum is pending/approved/rejected only. An
    open shift is represented by clock_out still being empty (see
    TimesheetEntry's derived .status in src/lib/hrData.ts and
    Notes/SCHEMA_REFERENCE.md). This used to read a KV row
    (hr_timesheets_prod_v1) from before the PocketBase migration, which the
    web app no longer writes to — that was silently making the agent stay
    "Paused" forever regardless of actual shift status."""
    if not employee_email:
        return False
    url = f"{base_url}/api/collections/hr_timesheets/records"
    params = {"filter": '(clock_out="")', "perPage": 200}
    resp = requests.get(url, params=params, timeout=15)
    resp.raise_for_status()
    items = resp.json().get("items", [])
    # employee_id on hr_timesheets actually stores the employee's email
    # (matches employeeEmail convention used everywhere else in the app).
    return any((it.get("employee_id") or "").lower() == employee_email.lower() for it in items)


# ─────────────────────── connection heartbeat / single-device claim ─────────
#
# Lets the web dashboard show a live "app is connected" indicator, and makes
# connecting from a second computer automatically supersede the first one —
# without needing a real backend. Each employee gets their own individual
# delcargo_store row (key: tracker_heartbeat_<slug>), matching db.ts's
# heartbeatKeyFor() on the web side. Whichever device most recently WROTE
# its deviceId into this row is the "claimed" device; every other device
# that later notices a mismatch treats itself as superseded and stops.

def heartbeat_key_for(email):
    return "tracker_heartbeat_" + re.sub(r"[^a-z0-9]", "_", (email or "").lower())


def get_device_label():
    try:
        return platform.node() or "Unknown device"
    except Exception:
        return "Unknown device"


def tray_location_hint():
    """OS-specific instructions for finding the app again after closing the
    window — this is the #1 "I closed it, how do I get it back" question."""
    system = platform.system()
    if system == "Windows":
        return "Look for its icon in the system tray near the clock (bottom-right) — click the ^ arrow there if it's hidden — and click it to reopen."
    if system == "Darwin":
        return "Look for its icon in the menu bar (top-right of the screen) and click it to reopen."
    return "Look for its icon in your system tray and click it to reopen."


def get_heartbeat(base_url, _unused_key, employee_email):
    key = heartbeat_key_for(employee_email)
    _, value = pb_get_kv(base_url, key)
    return value


def upsert_heartbeat(base_url, _unused_key, employee_email, device_id, device_label, connected_at=None):
    """Claims (or refreshes) this device's heartbeat row."""
    key = heartbeat_key_for(employee_email)
    now = datetime.now(timezone.utc).isoformat()
    value = {
        "employeeEmail": employee_email,
        "deviceId": device_id,
        "deviceLabel": device_label,
        "connectedAt": connected_at or now,
        "lastSeenAt": now,
    }
    pb_set_kv(base_url, key, value)


def capture_and_encode():
    """Captures a screenshot, resizes/compresses it, and returns raw WebP
    bytes plus its final width/height (no base64 — uploaded as a real file,
    see upload_screenshot). WebP at this quality/method settings is
    noticeably smaller than JPEG at a visually equivalent quality — cuts
    storage/bandwidth per screenshot without a visible quality loss."""
    img = pyautogui.screenshot()
    w, h = img.size
    if w > MAX_WIDTH:
        new_h = int(h * (MAX_WIDTH / w))
        img = img.resize((MAX_WIDTH, new_h), Image.LANCZOS)
        w, h = MAX_WIDTH, new_h
    buf = io.BytesIO()
    img.convert("RGB").save(buf, format="WEBP", quality=WEBP_QUALITY, method=6)
    return buf.getvalue(), w, h


def upload_screenshot(base_url, employee_email, webp_bytes, width, height, device_id=None, device_label=None, agent_token=None):
    """Uploads a screenshot as a real file into the hr_screenshots collection
    (multipart/form-data) — replaces the old approach of embedding a base64
    data URL inside a JSON row in hr_delcargo_store. See
    migration_data/create_screenshots_collection.py for the collection
    schema (mimeTypes there must include image/webp)."""
    timestamp = datetime.now(timezone.utc).isoformat()
    filename = f"scr_{int(time.time() * 1000)}_{uuid.uuid4().hex[:6]}.webp"
    url = f"{base_url}/api/collections/hr_screenshots/records"
    data = {
        "employee_email": employee_email or "",
        "captured_at": timestamp,
        "width": str(width),
        "height": str(height),
    }
    if device_id:
        data["device_id"] = device_id
    if device_label:
        data["device_label"] = device_label
    if agent_token:
        data["agent_token"] = agent_token
    files = {"image": (filename, webp_bytes, "image/webp")}
    resp = requests.post(url, data=data, files=files, timeout=30)
    resp.raise_for_status()
    return timestamp


def upload_inactivity(base_url, employee_email, start_dt, end_dt, device_id=None, device_label=None, agent_token=None):
    """Uploads one completed mouse-inactivity interval (>= 3 minutes with no
    cursor movement) into the hr_inactivity_logs collection — see
    migration_data/create_inactivity_logs_collection.py for the schema."""
    duration_seconds = int((end_dt - start_dt).total_seconds())
    url = f"{base_url}/api/collections/hr_inactivity_logs/records"
    data = {
        "employee_email": employee_email or "",
        "start_at": start_dt.isoformat(),
        "end_at": end_dt.isoformat(),
        "duration_seconds": str(duration_seconds),
    }
    if device_id:
        data["device_id"] = device_id
    if device_label:
        data["device_label"] = device_label
    if agent_token:
        data["agent_token"] = agent_token
    resp = requests.post(url, headers=JSON_HEADERS, data=json.dumps(data), timeout=20)
    resp.raise_for_status()


# ─────────────────────────────── tray icon image ─────────────────────────────

def _app_icon_path():
    """Locates the brand icon next to this script in dev mode, or bundled
    alongside the frozen executable in a packaged build (see the
    --add-data flag in build_windows.bat / build_mac.sh)."""
    base = getattr(sys, "_MEIPASS", os.path.dirname(os.path.abspath(__file__)))
    path = os.path.join(base, "icon.png")
    return path if os.path.exists(path) else None


_ICON_SOURCE = None  # lazily loaded, cached Pillow Image of icon.png


def build_tray_image(active):
    """Uses the real DelCargo brand mark (icon.png, generated from
    "Tracker Icon.png" by generate_icons.py) for the tray icon, with a
    small green "live" dot overlaid while tracking is active. Falls back to
    a drawn monitor glyph if the icon asset isn't present (e.g. it hasn't
    been generated yet)."""
    global _ICON_SOURCE
    size = 64
    icon_path = _app_icon_path()
    if icon_path:
        if _ICON_SOURCE is None:
            _ICON_SOURCE = Image.open(icon_path).convert("RGBA")
        img = _ICON_SOURCE.resize((size, size), Image.LANCZOS).copy()
        if not active:
            # Dim to slate when tracking is off, matching the orange
            # (active) vs slate (idle) convention used elsewhere in the UI.
            gray = Image.new("RGBA", img.size, (100, 116, 139, 255))
            img = Image.blend(img.convert("RGBA"), gray, 0.35)
        if active:
            d = ImageDraw.Draw(img)
            d.ellipse([44, 2, 62, 20], fill=(16, 185, 129, 255), outline=(255, 255, 255, 255), width=2)
        return img

    # Fallback: simple monitor glyph drawn in-memory (no icon asset found).
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    color = (234, 88, 12, 255) if active else (100, 116, 139, 255)  # orange vs slate
    d.rounded_rectangle([8, 12, 56, 42], radius=5, outline=color, width=5)
    d.rectangle([26, 46, 38, 52], fill=color)
    d.rectangle([18, 52, 46, 56], fill=color)
    if active:
        d.ellipse([40, 4, 60, 24], fill=(16, 185, 129, 255))  # green "live" dot
    return img


# ───────────────────────────────── main app ──────────────────────────────────

class TrackerApp:
    def __init__(self, root):
        self.root = root
        self.root.title(APP_NAME)
        self.root.geometry("440x740")
        self.root.resizable(False, False)
        self.root.configure(bg=BG)
        self.root.protocol("WM_DELETE_WINDOW", self.on_close)
        self._set_window_icon()

        self.cfg = load_config()
        self.state_lock = threading.Lock()
        self.state = {
            "connected": self.cfg is not None,
            "enabled": False,
            "employee_email": (self.cfg or {}).get("employee_email", ""),
            "interval": None,
            "last_capture": None,
            "last_error": None,
            "connection_status": "unknown",  # "connected" | "disconnected" | "superseded"
            "superseded_device": None,
            "heartbeat_error": None,
        }
        self.stop_event = threading.Event()
        self.worker = None
        self.inactivity_worker = None
        self.tray_icon = None
        # Set when we should (re)claim the device slot on the worker loop's
        # next pass: a brand new connect, an upgrade from an older install
        # that never had a device_id, or a manual "Reconnect" click.
        self.force_claim_next = False

        if self.cfg and not self.cfg.get("device_id"):
            self.cfg["device_id"] = uuid.uuid4().hex
            self.cfg["device_label"] = get_device_label()
            save_config(self.cfg)
            self.force_claim_next = True

        self._build_style()
        if self.cfg:
            self._build_dashboard()
            self._start_worker()
        else:
            self._build_setup_screen()

        if pystray:
            self._start_tray()

        self.root.after(500, self._tick)

    # ---------- window icon ----------

    def _set_window_icon(self):
        """Sets the title-bar/taskbar icon from icon.png (see
        generate_icons.py). Uses iconphoto (cross-platform, works from a
        PNG) rather than iconbitmap, which on Windows only accepts .ico.
        No-ops quietly if the icon hasn't been generated yet."""
        icon_path = _app_icon_path()
        if not icon_path:
            return
        try:
            self._icon_image = tk.PhotoImage(file=icon_path)  # kept on self: must outlive this call
            self.root.iconphoto(True, self._icon_image)
        except Exception:
            pass  # Non-critical — app still runs fine without a window icon.

    # ---------- styling ----------

    def _build_style(self):
        style = ttk.Style()
        try:
            style.theme_use("clam")
        except tk.TclError:
            pass
        style.configure("Accent.TButton", background=ACCENT, foreground="white", font=(FONT, 10, "bold"), padding=8)
        style.map("Accent.TButton", background=[("active", ACCENT_HOVER)])
        style.configure("Muted.TButton", padding=8, font=(FONT, 10))
        style.configure("TFrame", background=BG)
        style.configure("TLabel", background=BG, foreground=INK, font=(FONT, 10))
        style.configure("Title.TLabel", background=BG, foreground=INK, font=(FONT, 16, "bold"))
        style.configure("Muted.TLabel", background=BG, foreground=MUTED, font=(FONT, 9))
        style.configure("TCheckbutton", background=BG, foreground=INK, font=(FONT, 9, "bold"))
        style.configure("Card.TCheckbutton", background=CARD_BG, foreground=INK, font=(FONT, 9, "bold"))
        style.map("Card.TCheckbutton", background=[("active", CARD_BG)])

    def _brand_header(self, parent, subtitle=None):
        """Wordmark header matching the web dashboard's "DelCargo HR" mark
        (Sidebar.tsx: bold, orange-600, no icon) — kept text-only here too
        so the desktop app and web app read as the same brand, not a
        different logo bolted on."""
        row = tk.Frame(parent, bg=BG)
        row.pack(fill="x", anchor="w")
        tk.Label(row, text="DelCargo", font=(FONT, 17, "bold"), bg=BG, fg=INK).pack(side="left")
        tk.Label(row, text=" Tracker", font=(FONT, 17, "bold"), bg=BG, fg=ACCENT).pack(side="left")
        if subtitle:
            tk.Label(parent, text=subtitle, font=(FONT, 9), bg=BG, fg=MUTED,
                     wraplength=380, justify="left").pack(anchor="w", pady=(2, 0))

    # ---------- setup screen ----------

    def _build_setup_screen(self):
        for w in self.root.winfo_children():
            w.destroy()
        frame = tk.Frame(self.root, bg=BG, padx=28, pady=28)
        frame.pack(fill="both", expand=True)

        self._brand_header(frame, "Paste the one-time setup code your HR/Admin gave you (Screen Tracking → Setup Agent).")

        setup_card = Card(frame, padding=16)
        setup_card.pack(fill="x", pady=(18, 6))
        card_body = setup_card.inner

        tk.Label(card_body, text="SETUP CODE", font=(FONT, 8, "bold"), bg=CARD_BG, fg=MUTED).pack(anchor="w", pady=(0, 6))
        self.code_var = tk.StringVar()
        entry = tk.Text(card_body, height=5, width=40, wrap="word", font=("Consolas", 9),
                         relief="solid", borderwidth=1, highlightthickness=1,
                         highlightbackground=BORDER, highlightcolor=ACCENT)
        entry.pack(fill="x")
        self.code_entry = entry

        # Auto-detect a plausible setup code already sitting on the clipboard.
        try:
            clip = self.root.clipboard_get()
            decode_setup_code(clip)
            entry.insert("1.0", clip.strip())
        except Exception:
            pass

        self.setup_error_var = tk.StringVar()
        tk.Label(frame, textvariable=self.setup_error_var, fg=DANGER, bg=BG,
                 font=(FONT, 9, "bold"), wraplength=380, justify="left").pack(anchor="w", pady=(10, 10))

        PillButton(frame, "Connect", command=self._handle_connect, variant="primary").pack(fill="x", ipady=0, pady=(0, 8))

        # Only shown when getting here via "Use a Different Setup Code" from
        # an already-connected dashboard (not on first-ever launch) — lets
        # someone back out without losing their existing working connection.
        if self.cfg:
            PillButton(frame, "Cancel", command=self._build_dashboard, variant="secondary").pack(fill="x", pady=(0, 8))

        tk.Label(
            frame,
            text="This app only takes screenshots while your employer has actively turned tracking on for your account, and only while shown as “Connected — Active” below.",
            font=(FONT, 9), bg=BG, fg=MUTED, wraplength=380, justify="left"
        ).pack(anchor="w", pady=(16, 0))

    def _handle_connect(self):
        raw = self.code_entry.get("1.0", "end").strip()
        try:
            url, token = decode_setup_code(raw)
        except Exception:
            self.setup_error_var.set("That doesn't look like a valid setup code. Ask HR/Admin to re-copy it from the Setup Agent screen.")
            return

        self.setup_error_var.set("Checking…")
        self.root.update_idletasks()

        def worker():
            try:
                settings = get_tracking_settings(url, None, token)
            except Exception as e:
                self.root.after(0, lambda: self.setup_error_var.set(f"Couldn't reach the server: {e}"))
                return
            if settings is None:
                self.root.after(0, lambda: self.setup_error_var.set(
                    "This code isn't recognized. Ask HR/Admin to generate a fresh setup code for you."
                ))
                return

            # RBAC safeguard: the email this computer will report screenshots
            # under always comes from the server-side settings row matched
            # by the token — never from anything the user typed.
            resolved_email = settings.get("employeeEmail", "(unknown)")

            def confirm_and_save():
                ok = messagebox.askyesno(
                    APP_NAME,
                    f"This setup code belongs to:\n\n{resolved_email}\n\n"
                    "Is this you? Only continue if this is your own email address — "
                    "do not connect this computer using a coworker's code.",
                )
                if not ok:
                    self.setup_error_var.set("Setup cancelled. Paste your own setup code to continue.")
                    return
                self.cfg = {
                    "url": url, "token": token,
                    "employee_email": resolved_email,
                    "autostart": False,
                    "device_id": uuid.uuid4().hex,
                    "device_label": get_device_label(),
                }
                save_config(self.cfg)
                # This is a brand new connection — claim the device slot
                # outright. If some other computer was previously connected
                # for this account, it will notice on its next check-in that
                # it's no longer the claimed device and stop itself.
                self.force_claim_next = True
                self._on_connected()

            self.root.after(0, confirm_and_save)

        threading.Thread(target=worker, daemon=True).start()

    def _on_connected(self):
        self.state["connected"] = True
        self.state["employee_email"] = self.cfg.get("employee_email", "")
        self._build_dashboard()
        self._start_worker()

    # ---------- dashboard screen ----------

    def _build_dashboard(self):
        for w in self.root.winfo_children():
            w.destroy()
        frame = tk.Frame(self.root, bg=BG, padx=28, pady=24)
        frame.pack(fill="both", expand=True)

        self._brand_header(frame)
        tk.Label(frame, text=f"Connected as {self.state['employee_email']}", font=(FONT, 9), bg=BG, fg=MUTED).pack(anchor="w", pady=(2, 6))

        conn_row = tk.Frame(frame, bg=BG)
        conn_row.pack(fill="x", pady=(0, 14))
        self.conn_status_var = tk.StringVar(value="Checking connection…")
        tk.Label(conn_row, textvariable=self.conn_status_var, bg=BG, fg=MUTED, font=(FONT, 9, "bold"),
                 anchor="w", justify="left", wraplength=300).pack(side="left", fill="x", expand=True)
        self.reconnect_btn = PillButton(conn_row, "Reconnect", command=self._handle_reconnect,
                                         variant="secondary", width=100, height=28, font_size=8)
        self.reconnect_btn.pack(side="right")

        # Status card — the desktop equivalent of the dashboard's status
        # cards (rounded-2xl white card, bold status line + muted detail).
        status_card = Card(frame, padding=18)
        status_card.pack(fill="x", pady=(0, 16))
        self.status_var = tk.StringVar(value="Checking status…")
        self.status_label = tk.Label(status_card.inner, textvariable=self.status_var, bg=CARD_BG, fg=INK,
                                      font=(FONT, 13, "bold"), anchor="w", justify="left")
        self.status_label.pack(fill="x", anchor="w")
        self.detail_var = tk.StringVar(value="")
        tk.Label(status_card.inner, textvariable=self.detail_var, bg=CARD_BG, fg=MUTED,
                 font=(FONT, 9), justify="left", anchor="w", wraplength=320).pack(fill="x", anchor="w", pady=(6, 0))

        PillButton(frame, "Minimize to Tray", command=self.hide_window, variant="secondary").pack(fill="x", pady=(0, 10))

        settings_card = Card(frame, padding=14)
        settings_card.pack(fill="x", pady=(0, 14))
        self.autostart_var = tk.BooleanVar(value=bool(self.cfg.get("autostart", False)))
        ttk.Checkbutton(settings_card.inner, text="Start automatically when I log in",
                         variable=self.autostart_var, command=self._toggle_autostart,
                         style="Card.TCheckbutton").pack(anchor="w", pady=(0, 8))
        self.close_to_tray_var = tk.BooleanVar(value=bool(self.cfg.get("close_to_tray", True)))
        ttk.Checkbutton(settings_card.inner, text="Closing the window (✕) minimizes to tray instead of quitting",
                         variable=self.close_to_tray_var, command=self._toggle_close_to_tray,
                         style="Card.TCheckbutton", state=("normal" if pystray else "disabled")).pack(anchor="w")

        tk.Label(
            frame,
            text=(tray_location_hint() if pystray and self.close_to_tray_var.get()
                  else "Closing this window (✕) fully quits the app." if not (pystray and self.close_to_tray_var.get())
                  else ""),
            font=(FONT, 9), bg=BG, fg=MUTED, wraplength=380, justify="left"
        ).pack(anchor="w", pady=(0, 16))

        PillButton(frame, "Use a Different Setup Code", command=self._build_setup_screen, variant="secondary").pack(fill="x", pady=(0, 8))
        PillButton(frame, "Disconnect this computer", command=self._handle_disconnect, variant="danger").pack(fill="x")

        tk.Label(
            frame,
            text="\"Use a Different Setup Code\" keeps the app open and just swaps which account it reports to — handy for reconnecting or switching accounts. \"Disconnect\" fully removes setup and stops the app until reconnected.",
            font=(FONT, 9), bg=BG, fg=MUTED, wraplength=380, justify="left"
        ).pack(anchor="w", pady=(16, 0))

    def _toggle_autostart(self):
        enabled = self.autostart_var.get()
        self.cfg["autostart"] = enabled
        save_config(self.cfg)
        threading.Thread(target=set_autostart, args=(enabled,), daemon=True).start()

    def _toggle_close_to_tray(self):
        # Explicit user preference — previously the app always hid to tray
        # on close whenever a tray icon was available, with no way to opt
        # out short of "Quit" from the tray menu. Some users would rather
        # ✕ just quit the app outright.
        self.cfg["close_to_tray"] = self.close_to_tray_var.get()
        save_config(self.cfg)

    def _handle_disconnect(self):
        if not messagebox.askyesno(APP_NAME, "Disconnect this computer from screen tracking? You'll need a new setup code from HR/Admin to reconnect."):
            return
        self.stop_event.set()
        clear_config()
        if self.cfg.get("autostart"):
            set_autostart(False)
        self.cfg = None
        self.state = {
            "connected": False, "enabled": False, "employee_email": "", "interval": None,
            "last_capture": None, "last_error": None, "connection_status": "unknown",
            "superseded_device": None, "heartbeat_error": None,
        }
        self.force_claim_next = False
        self.stop_event = threading.Event()
        self._build_setup_screen()

    # ---------- background worker ----------

    def _start_worker(self):
        # If a previous worker thread is still running (e.g. this is a
        # "change setup code" reconnect, not the first-ever connect), stop
        # it first. Each thread is handed its own cfg/stop_event snapshot
        # (see _worker_loop) rather than reading self.cfg live, specifically
        # so an old thread can never silently keep running against stale
        # credentials after the user connects with a different code.
        if self.worker and self.worker.is_alive():
            self.stop_event.set()
            self.worker.join(timeout=2)
        if self.inactivity_worker and self.inactivity_worker.is_alive():
            self.inactivity_worker.join(timeout=2)
        self.stop_event = threading.Event()
        self.worker = threading.Thread(target=self._worker_loop, args=(self.cfg, self.stop_event), daemon=True)
        self.worker.start()
        self.inactivity_worker = threading.Thread(target=self._inactivity_loop, args=(self.cfg, self.stop_event), daemon=True)
        self.inactivity_worker.start()

    def _checkin(self, cfg):
        """Claims (first run / reconnect) or refreshes this device's
        heartbeat row. Returns False if another device has since claimed
        this account (this device should stand down)."""
        force = self.force_claim_next
        self.force_claim_next = False
        try:
            if not force:
                # These PocketBase collections are open/public (no anon key
                # needed) — the middle arg is intentionally None; see
                # _unused_key params on get_heartbeat/upsert_heartbeat/etc.
                hb = get_heartbeat(cfg["url"], None, cfg["employee_email"])
                if hb and hb.get("deviceId") and hb.get("deviceId") != cfg.get("device_id"):
                    with self.state_lock:
                        self.state["connection_status"] = "superseded"
                        self.state["superseded_device"] = hb.get("deviceLabel") or "another computer"
                        self.state["heartbeat_error"] = None
                    return False
                preserved_connected_at = (hb or {}).get("connectedAt")
            else:
                preserved_connected_at = None

            upsert_heartbeat(
                cfg["url"], None, cfg["employee_email"],
                cfg.get("device_id"), cfg.get("device_label", ""),
                connected_at=preserved_connected_at,
            )
            with self.state_lock:
                self.state["connection_status"] = "connected"
                self.state["superseded_device"] = None
                self.state["heartbeat_error"] = None
            return True
        except Exception as e:
            with self.state_lock:
                self.state["connection_status"] = "disconnected"
                self.state["heartbeat_error"] = f"Couldn't reach the server: {e}"
            # A network blip shouldn't permanently stand this device down —
            # keep trying tracking settings/capture as before; only an
            # explicit supersede (a different deviceId) stops the agent.
            return True

    def _handle_reconnect(self):
        if not self.cfg:
            return
        self.force_claim_next = True
        with self.state_lock:
            self.state["heartbeat_error"] = None
        if not (self.worker and self.worker.is_alive()):
            self._start_worker()

        def worker():
            try:
                upsert_heartbeat(
                    self.cfg["url"], None, self.cfg["employee_email"],
                    self.cfg.get("device_id"), self.cfg.get("device_label", ""),
                )
                with self.state_lock:
                    self.state["connection_status"] = "connected"
                    self.state["superseded_device"] = None
                    self.state["heartbeat_error"] = None
                self.force_claim_next = False
            except Exception as e:
                with self.state_lock:
                    self.state["heartbeat_error"] = f"Reconnect failed: {e}"
                    self.state["connection_status"] = "disconnected"

        threading.Thread(target=worker, daemon=True).start()

    def _worker_loop(self, cfg, stop_event):
        # cfg and stop_event are captured as explicit arguments (a snapshot
        # at the moment this thread was started) rather than read live off
        # self — if the user later connects with a different setup code,
        # _start_worker() stops this exact stop_event and spawns a brand
        # new thread with the new cfg, so there's never any ambiguity about
        # which credentials an old, lingering thread might still be using.
        while not stop_event.is_set():
            if not self._checkin(cfg):
                # Superseded by another device — don't poll tracking
                # settings or capture anything until reconnected.
                with self.state_lock:
                    self.state["enabled"] = False
                stop_event.wait(SETTINGS_POLL_SECONDS)
                continue

            try:
                settings = get_tracking_settings(cfg["url"], None, cfg["token"])
            except Exception as e:
                with self.state_lock:
                    self.state["last_error"] = str(e)
                stop_event.wait(SETTINGS_POLL_SECONDS)
                continue

            if settings is None:
                with self.state_lock:
                    self.state["enabled"] = False
                    self.state["last_error"] = "Setup token not recognized — ask HR/Admin to check your setup."
                stop_event.wait(SETTINGS_POLL_SECONDS)
                continue

            enabled_by_hr = bool(settings.get("enabled"))
            employee_email = settings.get("employeeEmail")
            
            try:
                shift_active = check_active_shift(cfg["url"], None, employee_email)
            except Exception as e:
                with self.state_lock:
                    self.state["last_error"] = f"Shift check failed: {e}"
                stop_event.wait(SETTINGS_POLL_SECONDS)
                continue

            enabled = enabled_by_hr and shift_active
            # 1 minute is the enforced floor (matches the minimum HR/Admin can
            # set on the dashboard — see TrackingView.tsx's interval input);
            # this max() is just a safety net for any older saved settings.
            interval_minutes = max(1.0, float(settings.get("intervalMinutes", 15)))
            with self.state_lock:
                self.state["enabled"] = enabled
                self.state["enabled_by_hr"] = enabled_by_hr
                self.state["shift_active"] = shift_active
                self.state["interval"] = interval_minutes
                self.state["last_error"] = None

            if enabled:
                try:
                    webp_bytes, w, h = capture_and_encode()
                    ts = upload_screenshot(
                        cfg["url"], settings.get("employeeEmail"), webp_bytes, w, h,
                        device_id=cfg.get("device_id"), device_label=cfg.get("device_label"),
                        agent_token=cfg.get("token"),
                    )
                    with self.state_lock:
                        self.state["last_capture"] = ts
                except Exception as e:
                    with self.state_lock:
                        self.state["last_error"] = f"Capture/upload failed: {e}"

            remaining = interval_minutes * 60 if enabled else SETTINGS_POLL_SECONDS
            waited = 0
            while waited < remaining and not stop_event.is_set():
                chunk = min(SETTINGS_POLL_SECONDS, remaining - waited)
                stop_event.wait(chunk)
                waited += chunk

    def _inactivity_loop(self, cfg, stop_event):
        """Samples the cursor position every MOUSE_POLL_SECONDS. Whenever the
        mouse hasn't moved for at least INACTIVITY_THRESHOLD_SECONDS and then
        moves again, uploads that whole idle stretch as one completed
        interval — matching how HR/Admin want to see "how long and when"
        inactivity happened within a shift, not a running live counter.

        Only counts idle time while tracking is actually enabled AND the
        employee's shift is active (self.state['enabled'], kept up to date by
        _worker_loop) — same gating screenshots use, so time spent off-shift
        or with tracking off is never reported as "inactivity". Runs as its
        own tight loop separate from _worker_loop, which only wakes up every
        SETTINGS_POLL_SECONDS/capture-interval and would miss short idle
        windows entirely.
        """
        last_pos = None
        last_move_time = time.monotonic()
        was_enabled = False

        while not stop_event.is_set():
            stop_event.wait(MOUSE_POLL_SECONDS)
            if stop_event.is_set():
                break

            with self.state_lock:
                enabled = bool(self.state.get("enabled"))
                employee_email = self.state.get("employee_email") or cfg.get("employee_email")

            now = time.monotonic()

            if not enabled:
                # Tracking just turned off (or shift ended) — don't let a gap
                # from before that moment get reported once it turns back on.
                last_pos = None
                last_move_time = now
                was_enabled = False
                continue

            if not was_enabled:
                # Tracking/shift just started — begin the idle clock fresh
                # rather than counting time from before we were watching.
                last_pos = None
                last_move_time = now
                was_enabled = True

            try:
                pos = pyautogui.position()
            except Exception:
                # Position lookup can occasionally fail (e.g. display/session
                # transitions) — skip this sample rather than crash the loop.
                continue

            if last_pos is None:
                last_pos = pos
                last_move_time = now
                continue

            if pos != last_pos:
                idle_seconds = now - last_move_time
                if idle_seconds >= INACTIVITY_THRESHOLD_SECONDS:
                    end_wall = datetime.now(timezone.utc)
                    start_wall = end_wall - timedelta(seconds=idle_seconds)
                    try:
                        upload_inactivity(
                            cfg["url"], employee_email, start_wall, end_wall,
                            device_id=cfg.get("device_id"), device_label=cfg.get("device_label"),
                            agent_token=cfg.get("token"),
                        )
                    except Exception as e:
                        with self.state_lock:
                            self.state["last_error"] = f"Inactivity log upload failed: {e}"
                last_pos = pos
                last_move_time = now

    # ---------- periodic UI refresh ----------

    def _tick(self):
        if self.cfg and hasattr(self, "status_var"):
            with self.state_lock:
                s = dict(self.state)

            if hasattr(self, "conn_status_var"):
                conn = s.get("connection_status")
                if conn == "superseded":
                    self.conn_status_var.set(f"\U0001f7e0 Connected elsewhere ({s.get('superseded_device') or 'another computer'}) — click Reconnect to take over here")
                elif conn == "connected":
                    label = (self.cfg or {}).get("device_label", "")
                    self.conn_status_var.set(f"\U0001f7e2 App Connected" + (f" ({label})" if label else ""))
                elif conn == "disconnected":
                    self.conn_status_var.set("\U0001f534 Not connected — " + (s.get("heartbeat_error") or "check your internet connection"))
                else:
                    self.conn_status_var.set("Checking connection…")

            if s.get("last_error"):
                self.status_var.set("⚠ Connection issue")
                self.detail_var.set(s["last_error"])
            elif s.get("enabled"):
                self.status_var.set("🟢 Tracking Active")
                last = s.get("last_capture")
                last_str = self._format_time(last) if last else "not yet"
                self.detail_var.set(f"Interval: every {s.get('interval') or '?'} min\nLast capture: {last_str}")
            elif s.get("enabled_by_hr") and not s.get("shift_active"):
                self.status_var.set("⏸ Tracking Paused")
                self.detail_var.set("Waiting for your shift to start.\nTracking will automatically resume when you clock in.")
            else:
                self.status_var.set("⚪ Tracking Off")
                self.detail_var.set("Waiting for HR/Admin to enable tracking for your account.\nNothing is being captured right now.")
            if self.tray_icon:
                try:
                    self.tray_icon.icon = build_tray_image(bool(s.get("enabled")))
                except Exception:
                    pass
        self.root.after(2000, self._tick)

    @staticmethod
    def _format_time(iso_str):
        try:
            dt = datetime.fromisoformat(iso_str.replace("Z", "+00:00")).astimezone()
            return dt.strftime("%I:%M %p").lstrip("0")
        except Exception:
            return iso_str

    # ---------- window/tray lifecycle ----------

    def hide_window(self):
        self.root.withdraw()
        # One-time reminder of where to find the app again — this is the
        # most common point of confusion ("I closed it, how do I reopen
        # it?"). Only shown once per run so it isn't annoying on every
        # minimize.
        if not getattr(self, "_shown_tray_hint", False):
            self._shown_tray_hint = True
            if self.tray_icon:
                try:
                    self.tray_icon.notify(tray_location_hint(), title=APP_NAME + " is still running")
                except Exception:
                    pass  # Notifications aren't supported on every OS/config — non-critical.

    def show_window(self):
        self.root.deiconify()
        self.root.lift()
        self.root.focus_force()

    def on_close(self):
        # Respects the "Closing the window minimizes to tray" setting (see
        # _toggle_close_to_tray) — previously this always hid to tray
        # whenever a tray icon existed, with no opt-out.
        close_to_tray = bool((self.cfg or {}).get("close_to_tray", True))
        if pystray and self.tray_icon and close_to_tray:
            self.hide_window()
        else:
            self.quit_app()

    def quit_app(self):
        self.stop_event.set()
        if self.tray_icon:
            try:
                self.tray_icon.stop()
            except Exception:
                pass
        self.root.after(100, self.root.destroy)

    def _start_tray(self):
        def on_show(icon, item):
            self.root.after(0, self.show_window)

        def on_quit(icon, item):
            icon.stop()
            self.root.after(0, self.quit_app)

        menu = pystray.Menu(
            pystray.MenuItem("Open " + APP_NAME, on_show, default=True),
            pystray.MenuItem("Quit", on_quit),
        )
        self.tray_icon = pystray.Icon(APP_NAME, build_tray_image(False), APP_NAME, menu)
        threading.Thread(target=self.tray_icon.run, daemon=True).start()


def main():
    root = tk.Tk()
    TrackerApp(root)
    root.mainloop()


if __name__ == "__main__":
    main()
