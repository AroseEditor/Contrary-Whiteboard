#define MyAppName "Contrary Whiteboard"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "Arose Editor"
#define MyAppURL "https://github.com/AroseEditor/Contrary-Whiteboard"
#define MyAppExeName "ContraryWhiteboard.exe"

[Setup]
; NOTE: The value of AppId uniquely identifies this application.
; Do not use the same AppId value in installers for other applications.
; (To generate a new GUID, click Tools | Generate GUID inside the IDE.)
AppId={{ba55b08a-0463-448e-9c7c-b448cc3d5a67}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}
DefaultDirName={autopf}\{#MyAppName}
DefaultGroupName={#MyAppName}
AllowNoIcons=yes
OutputDir=..
OutputBaseFilename=ContraryWhiteboard-{#MyAppVersion}-setup
Compression=lzma
SolidCompression=yes
WizardStyle=modern
ArchitecturesInstallIn64BitMode=x64
SetupIconFile=..\resources\win\ContraryWhiteboard.ico

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"
Name: "french"; MessagesFile: "compiler:Languages\French.isl"
Name: "german"; MessagesFile: "compiler:Languages\German.isl"
Name: "spanish"; MessagesFile: "compiler:Languages\Spanish.isl"
Name: "italian"; MessagesFile: "compiler:Languages\Italian.isl"
Name: "russian"; MessagesFile: "compiler:Languages\Russian.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked

[Files]
Source: "..\build\win32\release\product\{#MyAppExeName}"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\build\win32\release\product\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs
; NOTE: Don't enable 'ignoreversion' on any shared system files

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "{cm:LaunchProgram,{#StringChange(MyAppName, '&', '&&')}}"; Flags: nowait postinstall

[Registry]
; .cwb file association
Root: HKA; Subkey: "Software\Classes\.cwb"; ValueType: string; ValueName: ""; ValueData: "ContraryWhiteboardFile"; Flags: uninsdeletevalue
Root: HKA; Subkey: "Software\Classes\ContraryWhiteboardFile"; ValueType: string; ValueName: ""; ValueData: "Contrary Whiteboard Document"; Flags: uninsdeletekey
Root: HKA; Subkey: "Software\Classes\ContraryWhiteboardFile\DefaultIcon"; ValueType: string; ValueName: ""; ValueData: "{app}\{#MyAppExeName},0"
Root: HKA; Subkey: "Software\Classes\ContraryWhiteboardFile\shell\open\command"; ValueType: string; ValueName: ""; ValueData: """{app}\{#MyAppExeName}"" ""%1"""
; Legacy .ubz association
Root: HKA; Subkey: "Software\Classes\.ubz"; ValueType: string; ValueName: ""; ValueData: "ContraryWhiteboardFile"; Flags: uninsdeletevalue
