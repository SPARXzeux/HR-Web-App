# DelCargo Tracker (desktop agent)

A small desktop app employees install once so HR/Admin-approved screen
tracking can run in the background, with a system tray icon and a "start on
login" option — no Python knowledge required to *use* it.

## For employees

You shouldn't need anything in this folder. Download the ready-built app
for your OS from the latest GitHub Release of this repo, run it, and paste
your own setup code — get it from your Shift Tracker page in the dashboard
(HR/Admin can also generate and hand you one from their Screen Tracking
page, but you don't need to wait on them). Before it connects, the app
shows you which email address the code belongs to — always double-check
that's you, and never paste a coworker's code into your own copy of the
app. See the in-app instructions for the rest.

## For whoever builds/maintains this

This is Python source (`agent_gui.py`) packaged into a standalone `.exe`
(Windows) / app (macOS) with [PyInstaller](https://pyinstaller.org). Because
PyInstaller does not cross-compile, you need to build on each target OS —
or let CI do it:

- **Automatic (recommended):** push a tag like `tracker-agent-v1` (or run
  the workflow manually from the Actions tab). `.github/workflows/build-tracker-agent.yml`
  builds both the Windows `.exe` and the macOS app on GitHub-hosted runners
  and attaches them to a GitHub Release.
- **Manual, on Windows:** `build_windows.bat`
- **Manual, on Mac:** `bash build_mac.sh`

## Local development (no packaging)

```
pip install -r requirements.txt
python agent_gui.py
```

## Setup codes

The web dashboard's Screen Tracking → "Setup Agent" panel generates a
single copyable setup code (base64 of `{"u": supabaseUrl, "k": anonKey,
"t": agentToken}`) instead of asking employees to paste three separate
values. `decode_setup_code()` / `encode_setup_code()` in `agent_gui.py` are
the matching implementation — keep them in sync with `copySetupCode` in
`src/components/ui/TrackingView.tsx` if the format ever changes.

## Installer experience (Windows)

`setup.iss` (built with [Inno Setup](https://jrsoftware.org/isinfo.php))
now provides a full first-run install experience:

- **License/consent step** — `LICENSE.txt` (screen-monitoring consent +
  standard EULA terms) must be accepted before Next is enabled.
- **Desktop icon** — optional, via the "Create a desktop icon" task.
- **Taskbar pin** — optional, via the "Pin to taskbar" task (Windows
  requires the user to right-click → Pin once for unsigned installers;
  Microsoft removed silent taskbar pinning).
- **Start Menu entry** — always created (`{group}`), including an
  Uninstall shortcut.
- **Start on login** — optional, via the "Start automatically" task
  (same effect as the in-app "Start automatically when I log in"
  checkbox — either one works).

Rebuild the installer after changing `agent_gui.py`:
`build_windows.bat` (or the GitHub Actions workflow) → then compile
`setup.iss` with Inno Setup to produce `dist\DelCargo_Tracker_Setup.exe`.

## Close-to-tray behavior

The dashboard status screen now has a **"Closing the window (✕) minimizes
to tray instead of quitting"** checkbox (on by default when a tray icon is
available). Previously this was hardcoded — closing always hid to tray
with no way to opt out short of "Quit" from the tray menu. The setting is
saved per-device in `config.json` right alongside the setup connection.

## Notes / limitations

- Unsigned builds: Windows SmartScreen and macOS Gatekeeper will both show
  an "unknown publisher" warning on first run. Getting rid of that requires
  a paid code-signing certificate (Windows) and an Apple Developer account +
  notarization (Mac) — worth doing before a wider rollout, not required for
  small-scale testing.
- **Auto-update:** the very first thing the app does on every launch is
  check GitHub's latest release against the local `APP_VERSION` constant
  near the top of `agent_gui.py`. If GitHub's tag is newer, it prompts the
  employee to update — Windows downloads and launches the new installer
  automatically (then quits itself so the installer can overwrite it);
  macOS downloads the zip to Downloads and reveals it in Finder with
  instructions, since safely auto-replacing a running unsigned `.app`
  bundle from inside itself isn't reliable. **When releasing a new
  version, bump `APP_VERSION` in `agent_gui.py` AND push a matching
  `tracker-agent-v<N>` tag together** — the update check only trusts that
  integer, not the build itself.
- Runs entirely against the self-hosted PocketBase server; there is no
  separate backend or API key required (matches the rest of the app's
  current security model — see the caveat below).
- Screenshots are uploaded as real files into the dedicated `hr_screenshots`
  PocketBase collection (see `migration_data/create_screenshots_collection.py`)
  rather than embedded as base64 JSON — smaller uploads, native thumbnails,
  and the dashboard serves them directly via PocketBase file URLs. Legacy
  base64 screenshots captured before this change remain viewable (see
  `getScreenshots()` in `src/lib/hrData.ts`).
- Screenshots are always labeled with the `employeeEmail` resolved
  server-side from the settings row matched by the pasted token — the app
  itself never declares whose screenshots they are. Combined with the
  in-app "is this you?" confirmation before connecting, this prevents
  *accidental* mislabeling from a mixed-up setup code. It is not a real
  access-control boundary (no RLS/auth yet — see `src/lib/db.ts`'s
  `TrackingSettings` doc comment), so don't treat it as one.
