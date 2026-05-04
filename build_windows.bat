@echo off
setlocal enabledelayedexpansion

:: ==========================================
:: CONTRARY WHITEBOARD - WINDOWS BUILD SCRIPT
:: ==========================================

:: Try to detect VCPKG_ROOT if not set
if "%VCPKG_ROOT%"=="" (
    for /f "delims=" %%i in ('where vcpkg 2^>nul') do (
        set "VCPKG_EXE_PATH=%%i"
        for %%j in ("!VCPKG_EXE_PATH!") do set "DETECTED_ROOT=%%~dpj"
        :: Only use if it's not the current directory
        if /i not "!DETECTED_ROOT!"=="%CD%\" (
            if /i not "!DETECTED_ROOT!"=="%CD%" (
                set "VCPKG_ROOT=!DETECTED_ROOT!"
            )
        )
    )
)

if "%VCPKG_ROOT%"=="" set "VCPKG_ROOT=C:\vcpkg"
:: Remove trailing backslash if any
if "!VCPKG_ROOT:~-1!"=="\" set "VCPKG_ROOT=!VCPKG_ROOT:~0,-1!"

echo [1/6] Checking environment...

:: Check if we are in GitHub Actions or a local environment
if "%Qt6_DIR%" neq "" (
    set "QT_ROOT=%Qt6_DIR%\.."
) else if "%QT_ROOT%"=="" (
    set "QT_ROOT=%CD%\qt_local\6.8.3\msvc2022_64"
)

:: Ensure paths are absolute
pushd "%VCPKG_ROOT%" 2>nul && (set "VCPKG_ROOT=%CD%" & popd)
pushd "%QT_ROOT%" 2>nul && (set "QT_ROOT=%CD%" & popd)

echo VCPKG_ROOT: %VCPKG_ROOT%
echo QT_ROOT:    %QT_ROOT%

:: 2. Install Qt Locally if missing
if not exist "%QT_ROOT%\bin\qmake.exe" (
    echo [2/6] Setting up isolated Qt environment...
    set "LOCAL_QT_DIR=%CD%\qt_local"
    set "QT_VERSION=6.8.3"
    pip install aqtinstall==3.1.* --quiet
    python -m aqt install-qt windows desktop 6.8.3 win64_msvc2022_64 --outputdir "!LOCAL_QT_DIR!" --modules qtwebengine qtmultimedia qt5compat qtwebchannel qtpositioning qtserialport
    set "QT_ROOT=!LOCAL_QT_DIR!\6.8.3\msvc2022_64"
) else (
    echo [2/6] Using existing Qt at %QT_ROOT%
)

:: Detect Qt root reliably
if defined Qt6_DIR (
    :: Qt6_DIR is usually path/to/lib/cmake/Qt6
    set "QT_ROOT=%Qt6_DIR%\..\..\.."
    for %%i in ("%QT_ROOT%") do set "QT_ROOT=%%~fi"
)

if not exist "%QT_ROOT%\bin\windeployqt.exe" (
    echo [ERROR] could not find windeployqt.exe in %QT_ROOT%\bin
    :: Fallback search if the above fails
    if exist "C:\Qt\6.8.3\msvc2022_64" set "QT_ROOT=C:\Qt\6.8.3\msvc2022_64"
)
echo Using Qt from: %QT_ROOT%

:: Ensure SerialPort is installed (it was missing in previous runs)
if not exist "%QT_ROOT%\bin\Qt6SerialPort.dll" (
    echo [2/6] Adding missing QtSerialPort module...
    set "LOCAL_QT_DIR=%CD%\qt_local"
    python -m aqt install-qt windows desktop 6.8.3 win64_msvc2022_64 --outputdir "!LOCAL_QT_DIR!" --modules qtserialport --quiet
)

:: 3. Install Vcpkg Dependencies
echo [3/6] Installing dependencies via vcpkg...

:: Try to find vcpkg executable
set "VCPKG_EXE="
where vcpkg >nul 2>nul
if %ERRORLEVEL% equ 0 (
    set "VCPKG_EXE=vcpkg"
) else if exist "%VCPKG_ROOT%\vcpkg.exe" (
    set "VCPKG_EXE=%VCPKG_ROOT%\vcpkg.exe"
) else (
    echo [ERROR] vcpkg executable not found! Please ensure vcpkg is in your PATH or VCPKG_ROOT is set correctly.
    exit /b 1
)

:: Run vcpkg install
"%VCPKG_EXE%" install zlib:x64-windows ffmpeg:x64-windows pkgconf:x64-windows openssl:x64-windows
if %ERRORLEVEL% neq 0 exit /b 1

:: 4. Configure & Build
:: 4. Build with CMake
echo [4/6] Configuring and building with CMake...

:: Set Pkg-Config paths for FFmpeg/vcpkg
set "PKG_CONFIG_PATH=%VCPKG_ROOT%\installed\x64-windows\lib\pkgconfig"
set "PKG_CONFIG_EXECUTABLE=%VCPKG_ROOT%\installed\x64-windows\tools\pkgconf\pkgconf.exe"

cmake -S . -B build ^
    -DCMAKE_TOOLCHAIN_FILE="%VCPKG_ROOT%\scripts\buildsystems\vcpkg.cmake" ^
    -DCMAKE_PREFIX_PATH="%QT_ROOT%" ^
    -DQT_VERSION=6 ^
    -DCMAKE_BUILD_TYPE=Release ^
    -DOPENSSL_ROOT_DIR="%VCPKG_ROOT%\installed\x64-windows" ^
    -DPKG_CONFIG_EXECUTABLE="%PKG_CONFIG_EXECUTABLE%" ^
    -DENV{PKG_CONFIG_PATH}="%PKG_CONFIG_PATH%"

if %ERRORLEVEL% neq 0 (
    echo CMake configuration failed.
    exit /b %ERRORLEVEL%
)

cmake --build build --config Release --parallel
if %ERRORLEVEL% neq 0 exit /b 1

:: 5. Deployment and Staging
echo [5/6] Deploying and staging...
if exist dist rmdir /s /q dist
mkdir dist

cmake --install build --prefix dist

:: Add Qt and vcpkg to PATH for windeployqt
set "OLD_PATH=%PATH%"
set "PATH=%QT_ROOT%\bin;%VCPKG_ROOT%\installed\x64-windows\bin;%PATH%"

:: Copy vcpkg DLLs
echo Copying dependencies...
if not exist "dist\bin" mkdir "dist\bin"
xcopy "%VCPKG_ROOT%\installed\x64-windows\bin\*.dll" "dist\bin\" /Y /Q >nul

:: Copy legacy thirdpartydeps DLLs (Poppler, etc.)
if exist "thirdpartydeps\poppler\bin" (
    xcopy "thirdpartydeps\poppler\bin\*.dll" "dist\bin\" /Y /Q >nul
)

:: Run windeployqt
echo Running windeployqt...
"%QT_ROOT%\bin\windeployqt.exe" ^
    --release ^
    --no-opengl-sw ^
    --no-translations ^
    --no-system-d3d-compiler ^
    --compiler-runtime ^
    "dist\bin\contrarywhiteboard.exe"

set "PATH=%OLD_PATH%"

:: Ensure icons exist
if not exist "dist\share\icons\hicolor\scalable\apps" mkdir "dist\share\icons\hicolor\scalable\apps"
copy "resources\images\ContraryWhiteboard.png" "dist\share\icons\hicolor\scalable\apps\" /Y >nul
copy "icon_converted.ico" "dist\share\icons\hicolor\scalable\apps\ContraryWhiteboard.ico" /Y >nul

:: 6. Build NSIS Installer
echo [6/6] Building NSIS Installer...
set "MAKENSIS=C:\Program Files (x86)\NSIS\makensis.exe"
if not exist "%MAKENSIS%" set "MAKENSIS=makensis.exe"

:: Version extraction
set "VERSION=1.0.0"
if exist version.txt (
    for /f "tokens=2 delims==" %%a in ('findstr VERSION_MAJ version.txt') do set V_MAJ=%%a
    for /f "tokens=2 delims==" %%a in ('findstr VERSION_MIN version.txt') do set V_MIN=%%a
    for /f "tokens=2 delims==" %%a in ('findstr VERSION_PATCH version.txt') do set V_PAT=%%a
    set "V_MAJ=!V_MAJ: =!"
    set "V_MIN=!V_MIN: =!"
    set "V_PAT=!V_PAT: =!"
    set "VERSION=!V_MAJ!.!V_MIN!.!V_PAT!"
)

if exist "installer\ContraryWhiteboard.nsi" (
    echo Using professional NSIS script...
    "%MAKENSIS%" /DAPP_VERSION=%VERSION% /DSTAGE_DIR="%CD%\dist" /DOUTPUT_DIR="%CD%" "installer\ContraryWhiteboard.nsi"
) else (
    echo Generating fallback NSIS script...
    set "NSI_FILE=build\installer.nsi"
    :: Use caret to escape exclamation marks when delayed expansion is ON
    echo Unicode True > "%NSI_FILE%"
    echo ^!include "MUI2.nsh" >> "%NSI_FILE%"
    echo Name "Contrary Whiteboard" >> "%NSI_FILE%"
    echo OutFile "..\ContraryWhiteboard-Setup.exe" >> "%NSI_FILE%"
    echo InstallDir "$PROGRAMFILES64\Contrary Whiteboard" >> "%NSI_FILE%"
    echo RequestExecutionLevel admin >> "%NSI_FILE%"
    echo ^!insertmacro MUI_PAGE_DIRECTORY >> "%NSI_FILE%"
    echo ^!insertmacro MUI_PAGE_INSTFILES >> "%NSI_FILE%"
    echo ^!insertmacro MUI_LANGUAGE "English" >> "%NSI_FILE%"
    echo Section "Install" >> "%NSI_FILE%"
    echo   SetOutPath "$INSTDIR" >> "%NSI_FILE%"
    echo   File /r "dist\*.*" >> "%NSI_FILE%"
    echo   CreateShortcut "$DESKTOP\Contrary Whiteboard.lnk" "$INSTDIR\bin\contrarywhiteboard.exe" >> "%NSI_FILE%"
    echo SectionEnd >> "%NSI_FILE%"
    "%MAKENSIS%" "%NSI_FILE%"
)

echo.
echo ============================================================
echo Build Complete!
echo Installer: ContraryWhiteboard-Setup.exe
echo ============================================================
if "%GITHUB_ACTIONS%"=="" pause
