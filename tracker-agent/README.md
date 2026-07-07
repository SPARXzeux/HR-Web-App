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

## Notes / limitations

- Unsigned builds: Windows SmartScreen and macOS Gatekeeper will both show
  an "unknown publisher" warning on first run. Getting rid of that requires
  a paid code-signing certificate (Windows) and an Apple Developer account +
  notarization (Mac) — worth doing before a wider rollout, not required for
  small-scale testing.
- No auto-update mechanism yet — if you change `agent_gui.py`, re-run the
  build/release and have employees reinstall.
- Uses the same public Supabase anon key already embedded in the web app;
  there is no separate backend. Acceptable for the current small-scale test
  phase, same caveat as the rest of this app's current security model.
- Screenshots are always labeled with the `employeeEmail` resolved
  server-side from the settings row matched by the pasted token — the app
  itself never declares whose screenshots they are. Combined with the
  in-app "is this you?" confirmation before connecting, this prevents
  *accidental* mislabeling from a mixed-up setup code. It is not a real
  access-control boundary (no RLS/auth yet — see `src/lib/db.ts`'s
  `TrackingSettings` doc comment), so don't treat it as one.
