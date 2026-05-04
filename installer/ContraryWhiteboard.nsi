; ===========================================================================
; Contrary Whiteboard - NSIS Installer Script
; Invoked by build.bat — do not run directly without /D defines
;
; Defines passed in from build.bat:
;   APP_VERSION   e.g. 1.0.0
;   STAGE_DIR     full path to staged install tree
;   OUTPUT_DIR    where the output .exe lands
; ===========================================================================

Unicode True

!define APP_NAME        "Contrary Whiteboard"
!define APP_EXE         "contrarywhiteboard.exe"
!define APP_PUBLISHER   "AroseEditor"
!define APP_URL         "https://github.com/AroseEditor/Contrary-Whiteboard"
!define REG_KEY         "Software\Microsoft\Windows\CurrentVersion\Uninstall\ContraryWhiteboard"
!define INSTALL_REG_KEY "Software\ContraryWhiteboard"

; Passed from build.bat
; APP_VERSION, STAGE_DIR, OUTPUT_DIR

Name "${APP_NAME} ${APP_VERSION}"
OutFile "${OUTPUT_DIR}\ContraryWhiteboard-${APP_VERSION}-setup.exe"
InstallDir "$PROGRAMFILES64\${APP_NAME}"
InstallDirRegKey HKLM "${INSTALL_REG_KEY}" "InstallDir"
RequestExecutionLevel admin

SetCompressor /SOLID lzma
SetCompressorDictSize 32

; ----------- Modern UI -----------
!include "MUI2.nsh"
!include "FileFunc.nsh"
!include "LogicLib.nsh"

!define MUI_ABORTWARNING
!define MUI_ICON "${STAGE_DIR}\share\icons\hicolor\scalable\apps\ContraryWhiteboard.ico"
; If you have a proper .ico, swap the line above for:
; !define MUI_ICON "installer\ContraryWhiteboard.ico"

!define MUI_WELCOMEPAGE_TITLE "Install ${APP_NAME} ${APP_VERSION}"
!define MUI_WELCOMEPAGE_TEXT  "This wizard will install ${APP_NAME} on your computer.$\r$\n$\r$\nAn interactive whiteboard application for education and presentations."
!define MUI_FINISHPAGE_RUN          "$INSTDIR\bin\${APP_EXE}"
!define MUI_FINISHPAGE_RUN_TEXT     "Launch ${APP_NAME}"
!define MUI_FINISHPAGE_LINK         "Visit project homepage"
!define MUI_FINISHPAGE_LINK_LOCATION "${APP_URL}"

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_LICENSE "${STAGE_DIR}\..\LICENSE"
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

!insertmacro MUI_LANGUAGE "English"

; ----------- Version info in EXE properties -----------
VIProductVersion "${APP_VERSION}.0"
VIAddVersionKey /LANG=${LANG_ENGLISH} "ProductName"      "${APP_NAME}"
VIAddVersionKey /LANG=${LANG_ENGLISH} "ProductVersion"   "${APP_VERSION}"
VIAddVersionKey /LANG=${LANG_ENGLISH} "CompanyName"      "${APP_PUBLISHER}"
VIAddVersionKey /LANG=${LANG_ENGLISH} "FileDescription"  "${APP_NAME} Installer"
VIAddVersionKey /LANG=${LANG_ENGLISH} "FileVersion"      "${APP_VERSION}"
VIAddVersionKey /LANG=${LANG_ENGLISH} "LegalCopyright"   "GPL-3.0"

; ===========================================================================
; Install
; ===========================================================================

Section "Main Application" SEC_MAIN
    SectionIn RO  ; can't deselect

    SetOutPath "$INSTDIR"

    ; Copy the entire staged tree
    File /r "${STAGE_DIR}\*.*"

    ; Write install location to registry
    WriteRegStr HKLM "${INSTALL_REG_KEY}" "InstallDir" "$INSTDIR"
    WriteRegStr HKLM "${INSTALL_REG_KEY}" "Version"    "${APP_VERSION}"

    ; Add/Remove Programs entry
    WriteRegStr   HKLM "${REG_KEY}" "DisplayName"          "${APP_NAME}"
    WriteRegStr   HKLM "${REG_KEY}" "DisplayVersion"       "${APP_VERSION}"
    WriteRegStr   HKLM "${REG_KEY}" "Publisher"            "${APP_PUBLISHER}"
    WriteRegStr   HKLM "${REG_KEY}" "URLInfoAbout"         "${APP_URL}"
    WriteRegStr   HKLM "${REG_KEY}" "InstallLocation"      "$INSTDIR"
    WriteRegStr   HKLM "${REG_KEY}" "UninstallString"      '"$INSTDIR\Uninstall.exe"'
    WriteRegStr   HKLM "${REG_KEY}" "QuietUninstallString" '"$INSTDIR\Uninstall.exe" /S'
    WriteRegDWORD HKLM "${REG_KEY}" "NoModify"             1
    WriteRegDWORD HKLM "${REG_KEY}" "NoRepair"             1

    ; Estimate install size for ARP
    ${GetSize} "$INSTDIR" "/S=0K" $0 $1 $2
    IntFmt $0 "0x%08X" $0
    WriteRegDWORD HKLM "${REG_KEY}" "EstimatedSize" "$0"

    ; Write uninstaller
    WriteUninstaller "$INSTDIR\Uninstall.exe"

    ; Register .ubz file association
    WriteRegStr HKCR ".ubz"                       ""          "ContraryWhiteboard.ubz"
    WriteRegStr HKCR "ContraryWhiteboard.ubz"     ""          "Contrary Whiteboard Document"
    WriteRegStr HKCR "ContraryWhiteboard.ubz\DefaultIcon" "" "$INSTDIR\${APP_EXE},0"
    WriteRegStr HKCR "ContraryWhiteboard.ubz\shell\open\command" "" '"$INSTDIR\${APP_EXE}" "%1"'

SectionEnd

Section "Start Menu Shortcut" SEC_STARTMENU
    CreateDirectory "$SMPROGRAMS\${APP_NAME}"
    CreateShortcut  "$SMPROGRAMS\${APP_NAME}\${APP_NAME}.lnk" "$INSTDIR\${APP_EXE}"
    CreateShortcut  "$SMPROGRAMS\${APP_NAME}\Uninstall.lnk"   "$INSTDIR\Uninstall.exe"
SectionEnd

Section "Desktop Shortcut" SEC_DESKTOP
    CreateShortcut "$DESKTOP\${APP_NAME}.lnk" "$INSTDIR\${APP_EXE}"
SectionEnd

; ===========================================================================
; Uninstall
; ===========================================================================

Section "Uninstall"
    ; Remove shortcuts
    Delete "$SMPROGRAMS\${APP_NAME}\${APP_NAME}.lnk"
    Delete "$SMPROGRAMS\${APP_NAME}\Uninstall.lnk"
    RMDir  "$SMPROGRAMS\${APP_NAME}"
    Delete "$DESKTOP\${APP_NAME}.lnk"

    ; Remove files — wipe the install dir
    RMDir /r "$INSTDIR\bin"
    RMDir /r "$INSTDIR\share"
    RMDir /r "$INSTDIR\etc"
    RMDir /r "$INSTDIR\lib"
    RMDir /r "$INSTDIR\plugins"
    RMDir /r "$INSTDIR\translations"
    RMDir /r "$INSTDIR\resources"
    Delete   "$INSTDIR\Uninstall.exe"
    RMDir    "$INSTDIR"

    ; Remove registry entries
    DeleteRegKey HKLM "${REG_KEY}"
    DeleteRegKey HKLM "${INSTALL_REG_KEY}"
    DeleteRegKey HKCR ".ubz"
    DeleteRegKey HKCR "ContraryWhiteboard.ubz"

SectionEnd
