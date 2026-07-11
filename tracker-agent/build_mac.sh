#!/bin/bash
# Builds a standalone macOS app for the DelCargo Tracker agent.
# Run this ON A MAC (PyInstaller cannot cross-compile from Windows/Linux to
# macOS). The GitHub Actions workflow in
# .github/workflows/build-tracker-agent.yml does this automatically on a
# macos-latest runner if you don't want to build locally.
#
# Note: the resulting .app is unsigned. On first launch, macOS Gatekeeper
# will warn "cannot be opened because the developer cannot be verified" —
# the employee needs to right-click the app -> Open (once) to allow it, or
# System Settings -> Privacy & Security -> "Open Anyway". Proper code
# signing/notarization requires an active Apple Developer account and is a
# good next step before wider rollout.

set -e
python3 -m pip install --upgrade pip
pip3 install -r requirements.txt

# Regenerates icon.icns / icon.png from "Tracker Icon.png" if present —
# safe to skip (build still works, just without a custom icon) if you
# haven't added a brand icon file yet.
if [ -f "Tracker Icon.png" ]; then python3 generate_icons.py; fi

ICON_FLAG=""
if [ -f "icon.icns" ]; then ICON_FLAG='--icon icon.icns'; fi

# --add-data bundles icon.png inside the app so the in-app window icon and
# tray/menu-bar icon can find it at runtime via sys._MEIPASS (see
# _app_icon_path() in agent_gui.py). Skipped if icon.png doesn't exist.
DATA_FLAG=""
if [ -f "icon.png" ]; then DATA_FLAG='--add-data icon.png:.'; fi

pyinstaller --onefile --windowed --name "DelCargo Tracker" $ICON_FLAG $DATA_FLAG agent_gui.py

echo ""
echo "Build complete. Find it at dist/DelCargo Tracker.app"
