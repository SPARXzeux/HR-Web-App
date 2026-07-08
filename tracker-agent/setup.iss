[Setup]
AppName=DelCargo Tracker
AppVersion=1.0
DefaultDirName={localappdata}\DelCargo Tracker
DefaultGroupName=DelCargo Tracker
UninstallDisplayIcon={app}\DelCargo Tracker.exe
Compression=lzma2
SolidCompression=yes
OutputDir=dist
OutputBaseFilename=DelCargo_Tracker_Setup
PrivilegesRequired=lowest
DisableProgramGroupPage=yes

[Files]
Source: "dist\DelCargo Tracker.exe"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{group}\DelCargo Tracker"; Filename: "{app}\DelCargo Tracker.exe"
Name: "{userdesktop}\DelCargo Tracker"; Filename: "{app}\DelCargo Tracker.exe"; Tasks: desktopicon
Name: "{userstartup}\DelCargo Tracker"; Filename: "{app}\DelCargo Tracker.exe"; Tasks: startupicon

[Tasks]
Name: "desktopicon"; Description: "Create a &desktop icon"; GroupDescription: "Additional icons:"; Flags: unchecked
Name: "startupicon"; Description: "Start DelCargo Tracker automatically when I log in"; GroupDescription: "Startup:"; Flags: unchecked

[Run]
Filename: "{app}\DelCargo Tracker.exe"; Description: "Launch DelCargo Tracker"; Flags: nowait postinstall skipifsilent
