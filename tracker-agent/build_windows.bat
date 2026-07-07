@echo off
REM Builds a standalone Windows executable for the DelCargo Tracker agent.
REM Run this ON A WINDOWS MACHINE (PyInstaller cannot cross-compile from
REM Linux/Mac to Windows). The GitHub Actions workflow in
REM .github/workflows/build-tracker-agent.yml does this automatically on a
REM windows-latest runner if you don't want to build locally.

python -m pip install --upgrade pip
pip install -r requirements.txt

pyinstaller --onefile --windowed --name "DelCargo Tracker" agent_gui.py

echo.
echo Build complete. Find it at dist\DelCargo Tracker.exe
