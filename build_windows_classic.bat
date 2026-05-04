@echo off
setlocal enabledelayedexpansion

:: ==================================================
:: CONTRARY WHITEBOARD - CLASSIC WINDOWS BUILD SCRIPT
:: ==================================================

:: 1. Environment Setup
if "%VCPKG_ROOT%"=="" set "VCPKG_ROOT=C:\vcpkg"
echo [DEBUG] VCPKG_ROOT is: "%VCPKG_ROOT%"
echo [DEBUG] Qt6_DIR is: "%Qt6_DIR%"
if defined Qt6_DIR (
    :: Qt6_DIR is usually path/to/lib/cmake/Qt6
    :: We want path/to/bin/qmake.exe
    pushd "%Qt6_DIR%\..\..\.."
    set "QT_ROOT=%CD%"
    popd
)

if not exist "%QT_ROOT%\bin\qmake.exe" (
    echo [ERROR] qmake.exe not found at "%QT_ROOT%\bin"
    exit /b 1
)

echo [1/5] Setting up environment...
set PATH=%QT_ROOT%\bin;%PATH%

:: 2. Run qmake
echo [2/5] Running qmake...
if exist build\win32 rmdir /s /q build\win32
qmake ContraryWhiteboard.pro -spec win32-msvc "CONFIG+=release"
if %ERRORLEVEL% neq 0 exit /b %ERRORLEVEL%

:: 3. Build with nmake
echo [3/5] Building with nmake...
nmake /f Makefile.Release
if %ERRORLEVEL% neq 0 exit /b %ERRORLEVEL%

:: 4. Deployment
echo [4/5] Deploying Qt dependencies...
set "PRODUCT_DIR=build\win32\release\product"
windeployqt --release --force --no-translations --no-opengl-sw --compiler-runtime "%PRODUCT_DIR%\ContraryWhiteboard.exe"

:: Copy OpenBoard-style resources
echo Copying application resources...
xcopy /E /Y /I "resources\etc" "%PRODUCT_DIR%\etc"
xcopy /E /Y /I "resources\library" "%PRODUCT_DIR%\library"
xcopy /E /Y /I "resources\fonts" "%PRODUCT_DIR%\fonts"
mkdir "%PRODUCT_DIR%\i18n"
xcopy /Y "resources\i18n\*.qm" "%PRODUCT_DIR%\i18n\"

:: 5. Create Installer
echo [5/5] Compiling Inno Setup installer...
iscc installer\ContraryWhiteboard.iss
if %ERRORLEVEL% neq 0 exit /b %ERRORLEVEL%

echo Done! Installer created in the root directory.
