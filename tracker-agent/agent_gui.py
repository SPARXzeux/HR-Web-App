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
    "Setup Agent" dialog (no manually copying URLs/keys into a text file).
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
2. The app decodes the code into a Supabase URL / anon key / agent token,
   confirms it can find a matching tracking-settings row, and saves it
   locally (never re-asks unless "Disconnect" is used).
3. In the background, it polls Supabase every ~60s to check whether
   tracking is currently enabled for this token and what interval to use.
4. If enabled, it takes a screenshot, compresses it, and uploads it, then
   waits out the configured interval (checking for a "disable" in between).

Images are stored as base64 rows in Supabase's free-tier database (the
same generic `delcargo_store` table the web app already uses) rather than
a Storage bucket — fine for small-scale testing, but should move to a real
Storage bucket before scaling up.

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
import sys
import threading
import time
import uuid
from datetime import datetime, timezone

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
JPEG_QUALITY = 45
SETTINGS_POLL_SECONDS = 60
ACCENT = "#ea580c"  # matches the dashboard's orange-600 brand accent
INK = "#1e293b"
MUTED = "#64748b"
BG = "#f8fafc"


# ─────────────────────────── setup code helpers ────────────────────────────

def encode_setup_code(url, key, token):
    payload = json.dumps({"u": url, "k": key, "t": token}).encode("utf-8")
    return base64.urlsafe_b64encode(payload).decode("ascii")


def decode_setup_code(code):
    code = (code or "").strip()
    # Tolerate accidental whitespace/newlines from copy-paste.
    code = "".join(code.split())
    padded = code + "=" * (-len(code) % 4)
    data = base64.urlsafe_b64decode(padded.encode("ascii"))
    obj = json.loads(data.decode("utf-8"))
    url, key, token = obj.get("u"), obj.get("k"), obj.get("t")
    if not (url and key and token):
        raise ValueError("Setup code is missing required fields.")
    return url.rstrip("/"), key, token


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


# ───────────────────────────── capture/upload core ───────────────────────────

def supabase_headers(anon_key):
    return {
        "apikey": anon_key,
        "Authorization": f"Bearer {anon_key}",
        "Content-Type": "application/json",
    }


def get_tracking_settings(base_url, anon_key, agent_token):
    url = f"{base_url}/rest/v1/delcargo_store?key=eq.hr_tracking_settings_prod_v1&select=value"
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
    resp = requests.post(url, headers=headers, data=json.dumps(payload), timeout=20)
    resp.raise_for_status()
    return timestamp


# ─────────────────────────────── tray icon image ─────────────────────────────

def build_tray_image(active):
    """Draws a simple monitor glyph in-memory so we don't need to ship a
    separate binary icon asset in the repo."""
    size = 64
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
        self.root.geometry("420x460")
        self.root.resizable(False, False)
        self.root.configure(bg=BG)
        self.root.protocol("WM_DELETE_WINDOW", self.on_close)

        self.cfg = load_config()
        self.state_lock = threading.Lock()
        self.state = {
            "connected": self.cfg is not None,
            "enabled": False,
            "employee_email": (self.cfg or {}).get("employee_email", ""),
            "interval": None,
            "last_capture": None,
            "last_error": None,
        }
        self.stop_event = threading.Event()
        self.worker = None
        self.tray_icon = None

        self._build_style()
        if self.cfg:
            self._build_dashboard()
            self._start_worker()
        else:
            self._build_setup_screen()

        if pystray:
            self._start_tray()

        self.root.after(500, self._tick)

    # ---------- styling ----------

    def _build_style(self):
        style = ttk.Style()
        try:
            style.theme_use("clam")
        except tk.TclError:
            pass
        style.configure("Accent.TButton", background=ACCENT, foreground="white", font=("Segoe UI", 10, "bold"), padding=8)
        style.map("Accent.TButton", background=[("active", "#c2410c")])
        style.configure("Muted.TButton", padding=8)
        style.configure("TFrame", background=BG)
        style.configure("TLabel", background=BG, foreground=INK, font=("Segoe UI", 10))
        style.configure("Title.TLabel", background=BG, foreground=INK, font=("Segoe UI", 15, "bold"))
        style.configure("Muted.TLabel", background=BG, foreground=MUTED, font=("Segoe UI", 9))

    # ---------- setup screen ----------

    def _build_setup_screen(self):
        for w in self.root.winfo_children():
            w.destroy()
        frame = ttk.Frame(self.root, padding=28)
        frame.pack(fill="both", expand=True)

        ttk.Label(frame, text="DelCargo Tracker", style="Title.TLabel").pack(anchor="w")
        ttk.Label(
            frame,
            text="Paste the one-time setup code your HR/Admin gave you (Screen Tracking → Setup Agent).",
            style="Muted.TLabel", wraplength=360, justify="left"
        ).pack(anchor="w", pady=(6, 18))

        self.code_var = tk.StringVar()
        entry = tk.Text(frame, height=5, wrap="word", font=("Consolas", 9), relief="solid", borderwidth=1)
        entry.pack(fill="x", pady=(0, 6))
        self.code_entry = entry

        # Auto-detect a plausible setup code already sitting on the clipboard.
        try:
            clip = self.root.clipboard_get()
            decode_setup_code(clip)
            entry.insert("1.0", clip.strip())
        except Exception:
            pass

        self.setup_error_var = tk.StringVar()
        ttk.Label(frame, textvariable=self.setup_error_var, foreground="#dc2626", background=BG,
                  font=("Segoe UI", 9), wraplength=360, justify="left").pack(anchor="w", pady=(0, 10))

        ttk.Button(frame, text="Connect", style="Accent.TButton", command=self._handle_connect).pack(fill="x")

        ttk.Label(
            frame,
            text="This app only takes screenshots while your employer has actively turned tracking on for your account, and only while shown as “Connected — Active” below.",
            style="Muted.TLabel", wraplength=360, justify="left"
        ).pack(anchor="w", pady=(20, 0))

    def _handle_connect(self):
        raw = self.code_entry.get("1.0", "end").strip()
        try:
            url, key, token = decode_setup_code(raw)
        except Exception:
            self.setup_error_var.set("That doesn't look like a valid setup code. Ask HR/Admin to re-copy it from the Setup Agent screen.")
            return

        self.setup_error_var.set("Checking…")
        self.root.update_idletasks()

        def worker():
            try:
                settings = get_tracking_settings(url, key, token)
            except Exception as e:
                self.root.after(0, lambda: self.setup_error_var.set(f"Couldn't reach the server: {e}"))
                return
            if settings is None:
                self.root.after(0, lambda: self.setup_error_var.set(
                    "This code isn't recognized. Ask HR/Admin to generate a fresh setup code for you."
                ))
                return
            self.cfg = {
                "url": url, "key": key, "token": token,
                "employee_email": settings.get("employeeEmail", ""),
                "autostart": False,
            }
            save_config(self.cfg)
            self.root.after(0, self._on_connected)

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
        frame = ttk.Frame(self.root, padding=28)
        frame.pack(fill="both", expand=True)

        ttk.Label(frame, text="DelCargo Tracker", style="Title.TLabel").pack(anchor="w")
        ttk.Label(frame, text=f"Connected as {self.state['employee_email']}", style="Muted.TLabel").pack(anchor="w", pady=(2, 18))

        card = tk.Frame(frame, bg="white", highlightbackground="#e2e8f0", highlightthickness=1)
        card.pack(fill="x", pady=(0, 16))
        inner = ttk.Frame(card, padding=16)
        inner.configure(style="TFrame")
        inner.pack(fill="x")
        tk.Frame(inner, bg="white").pack()  # spacer (keeps ttk theme happy on white card)

        self.status_var = tk.StringVar(value="Checking status…")
        self.status_label = tk.Label(card, textvariable=self.status_var, bg="white", fg=INK, font=("Segoe UI", 12, "bold"), pady=14)
        self.status_label.pack(fill="x", padx=16)

        self.detail_var = tk.StringVar(value="")
        tk.Label(card, textvariable=self.detail_var, bg="white", fg=MUTED, font=("Segoe UI", 9), justify="left", anchor="w", padx=16, pady=(0, 14)).pack(fill="x")

        ttk.Button(frame, text="Minimize to Tray", style="Muted.TButton", command=self.hide_window).pack(fill="x", pady=(4, 8))

        self.autostart_var = tk.BooleanVar(value=bool(self.cfg.get("autostart", False)))
        cb = ttk.Checkbutton(frame, text="Start automatically when I log in", variable=self.autostart_var, command=self._toggle_autostart)
        cb.pack(anchor="w", pady=(4, 20))

        ttk.Button(frame, text="Disconnect this computer", command=self._handle_disconnect).pack(fill="x")

        ttk.Label(
            frame,
            text="Closing this window keeps the agent running quietly in the background (tray icon). Use “Disconnect” to fully stop and remove setup.",
            style="Muted.TLabel", wraplength=360, justify="left"
        ).pack(anchor="w", pady=(16, 0))

    def _toggle_autostart(self):
        enabled = self.autostart_var.get()
        self.cfg["autostart"] = enabled
        save_config(self.cfg)
        threading.Thread(target=set_autostart, args=(enabled,), daemon=True).start()

    def _handle_disconnect(self):
        if not messagebox.askyesno(APP_NAME, "Disconnect this computer from screen tracking? You'll need a new setup code from HR/Admin to reconnect."):
            return
        self.stop_event.set()
        clear_config()
        if self.cfg.get("autostart"):
            set_autostart(False)
        self.cfg = None
        self.state = {"connected": False, "enabled": False, "employee_email": "", "interval": None, "last_capture": None, "last_error": None}
        self.stop_event = threading.Event()
        self._build_setup_screen()

    # ---------- background worker ----------

    def _start_worker(self):
        if self.worker and self.worker.is_alive():
            return
        self.stop_event.clear()
        self.worker = threading.Thread(target=self._worker_loop, daemon=True)
        self.worker.start()

    def _worker_loop(self):
        cfg = self.cfg
        while not self.stop_event.is_set():
            try:
                settings = get_tracking_settings(cfg["url"], cfg["key"], cfg["token"])
            except Exception as e:
                with self.state_lock:
                    self.state["last_error"] = str(e)
                self.stop_event.wait(SETTINGS_POLL_SECONDS)
                continue

            if settings is None:
                with self.state_lock:
                    self.state["enabled"] = False
                    self.state["last_error"] = "Setup token not recognized — ask HR/Admin to check your setup."
                self.stop_event.wait(SETTINGS_POLL_SECONDS)
                continue

            enabled = bool(settings.get("enabled"))
            interval_minutes = max(1, int(settings.get("intervalMinutes", 15)))
            with self.state_lock:
                self.state["enabled"] = enabled
                self.state["interval"] = interval_minutes
                self.state["last_error"] = None

            if enabled:
                try:
                    image_data_url = capture_and_encode()
                    ts = upload_screenshot(cfg["url"], cfg["key"], settings.get("employeeEmail"), image_data_url)
                    with self.state_lock:
                        self.state["last_capture"] = ts
                except Exception as e:
                    with self.state_lock:
                        self.state["last_error"] = f"Capture/upload failed: {e}"

            remaining = interval_minutes * 60 if enabled else SETTINGS_POLL_SECONDS
            waited = 0
            while waited < remaining and not self.stop_event.is_set():
                chunk = min(SETTINGS_POLL_SECONDS, remaining - waited)
                self.stop_event.wait(chunk)
                waited += chunk

    # ---------- periodic UI refresh ----------

    def _tick(self):
        if self.cfg and hasattr(self, "status_var"):
            with self.state_lock:
                s = dict(self.state)
            if s.get("last_error"):
                self.status_var.set("⚠ Connection issue")
                self.detail_var.set(s["last_error"])
            elif s.get("enabled"):
                self.status_var.set("\U0001f7e2 Tracking Active")
                last = s.get("last_capture")
                last_str = self._format_time(last) if last else "not yet"
                self.detail_var.set(f"Interval: every {s.get('interval') or '?'} min\nLast capture: {last_str}")
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

    def show_window(self):
        self.root.deiconify()
        self.root.lift()
        self.root.focus_force()

    def on_close(self):
        if pystray and self.tray_icon:
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
