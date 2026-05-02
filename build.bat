@echo off
setlocal EnableDelayedExpansion

:: ===========================================================================
:: Contrary Whiteboard - Windows Build + NSIS Installer
:: ===========================================================================

:: ----------- CONFIGURE THESE FOR YOUR MACHINE -----------
set "QT_DIR=C:\Qt\6.11.0\mingw_64"
set "MINGW_DIR=C:\Qt\Tools\mingw1310_64\bin"
set "CMAKE_DIR=C:\Qt\Tools\CMake_64\bin"
set "NSIS_DIR=C:\Program Files (x86)\NSIS"
set "BUILD_TYPE=Release"
:: --------------------------------------------------------

pushd "%~dp0"
set "SCRIPT_DIR=%CD%"

:: ----------- Parse version.txt -----------
set "VERSION_MAJ=0"
set "VERSION_MIN=0"
set "VERSION_PATCH=0"
set "VERSION_TYPE=r"
for /f "usebackq tokens=1,2 delims== " %%A in ("%SCRIPT_DIR%\version.txt") do (
    if "%%A"=="VERSION_MAJ"   set "VERSION_MAJ=%%B"
    if "%%A"=="VERSION_MIN"   set "VERSION_MIN=%%B"
    if "%%A"=="VERSION_PATCH" set "VERSION_PATCH=%%B"
    if "%%A"=="VERSION_TYPE"  set "VERSION_TYPE=%%B"
)
set "APP_VERSION=!VERSION_MAJ!.!VERSION_MIN!.!VERSION_PATCH!"
if not "!VERSION_TYPE!"=="r" set "APP_VERSION=!APP_VERSION!-!VERSION_TYPE!"

echo.
echo ============================================
echo  Contrary Whiteboard Windows Build
echo  Version: !APP_VERSION!
echo  Config:  !BUILD_TYPE!
echo ============================================
echo.

:: ----------- Validate tools -----------
if not exist "!QT_DIR!\bin\qmake.exe" (
    echo [ERROR] Qt not found at !QT_DIR!
    echo         Edit QT_DIR at the top of this script.
    goto :fail
)
if not exist "!CMAKE_DIR!\cmake.exe" (
    echo [ERROR] CMake not found at !CMAKE_DIR!
    echo         Qt bundles CMake at C:\Qt\Tools\CMake_64\bin
    goto :fail
)
if not exist "!NSIS_DIR!\makensis.exe" (
    echo [ERROR] NSIS not found at !NSIS_DIR!
    echo         Install from https://nsis.sourceforge.io
    goto :fail
)

set "PATH=!QT_DIR!\bin;!MINGW_DIR!;!CMAKE_DIR!;!PATH!"

set "BUILD_DIR=!SCRIPT_DIR!\build\windows\!BUILD_TYPE!"
set "STAGE_DIR=!BUILD_DIR!\staged"
set "PRODUCT_DIR=!SCRIPT_DIR!\install\windows"
set "NSIS_SCRIPT=!SCRIPT_DIR!\installer\ContraryWhiteboard.nsi"

:: ----------- CMake Configure -----------
echo [1/4] Configuring CMake...
if not exist "!BUILD_DIR!" mkdir "!BUILD_DIR!"

"!CMAKE_DIR!\cmake.exe" -S "!SCRIPT_DIR!" -B "!BUILD_DIR!" ^
    -G "MinGW Makefiles" ^
    -DCMAKE_BUILD_TYPE=!BUILD_TYPE! ^
    -DCMAKE_PREFIX_PATH="!QT_DIR!" ^
    -DCMAKE_INSTALL_PREFIX="!STAGE_DIR!" ^
    -DCMAKE_MAKE_PROGRAM="!MINGW_DIR!\mingw32-make.exe"
if !ERRORLEVEL! neq 0 ( echo [ERROR] CMake configure failed. & goto :fail )

:: ----------- Build -----------
echo [2/4] Building...
"!CMAKE_DIR!\cmake.exe" --build "!BUILD_DIR!" --config !BUILD_TYPE! -j%NUMBER_OF_PROCESSORS%
if !ERRORLEVEL! neq 0 ( echo [ERROR] Build failed. & goto :fail )

:: ----------- Stage -----------
echo [3/4] Staging...
if not exist "!STAGE_DIR!" mkdir "!STAGE_DIR!"
"!CMAKE_DIR!\cmake.exe" --install "!BUILD_DIR!" --config !BUILD_TYPE!
if !ERRORLEVEL! neq 0 ( echo [ERROR] Install failed. & goto :fail )

:: windeployqt
set "EXE_PATH=!STAGE_DIR!\bin\contrarywhiteboard.exe"
if not exist "!EXE_PATH!" set "EXE_PATH=!STAGE_DIR!\contrarywhiteboard.exe"
"!QT_DIR!\bin\windeployqt.exe" --release --no-translations "!EXE_PATH!"
if !ERRORLEVEL! neq 0 ( echo [ERROR] windeployqt failed. & goto :fail )

:: OpenSSL
if exist "!SCRIPT_DIR!\thirdpartydeps\openssl\openssl-1.1.1j-win64\bin\libcrypto-1_1-x64.dll" (
    copy /Y "!SCRIPT_DIR!\thirdpartydeps\openssl\openssl-1.1.1j-win64\bin\libcrypto-1_1-x64.dll" "!STAGE_DIR!\bin\" >nul
    copy /Y "!SCRIPT_DIR!\thirdpartydeps\openssl\openssl-1.1.1j-win64\bin\libssl-1_1-x64.dll"    "!STAGE_DIR!\bin\" >nul
)

:: ----------- NSIS -----------
echo [4/4] Building installer...
if not exist "!PRODUCT_DIR!" mkdir "!PRODUCT_DIR!"
"!NSIS_DIR!\makensis.exe" /DAPP_VERSION="!APP_VERSION!" /DSTAGE_DIR="!STAGE_DIR!" /DOUTPUT_DIR="!PRODUCT_DIR!" "!NSIS_SCRIPT!"
if !ERRORLEVEL! neq 0 ( echo [ERROR] NSIS failed. & goto :fail )

echo.
echo ============================================
echo  Done!
echo  !PRODUCT_DIR!\ContraryWhiteboard-!APP_VERSION!-setup.exe
echo ============================================
popd
endlocal
exit /b 0

:fail
popd
endlocal
exit /b 1
