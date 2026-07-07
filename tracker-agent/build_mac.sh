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

pyinstaller --onefile --windowed --name "DelCargo Tracker" agent_gui.py

echo ""
echo "Build complete. Find it at dist/DelCargo Tracker.app"
