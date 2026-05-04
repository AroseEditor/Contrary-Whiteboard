@echo off
setlocal enabledelayedexpansion

:: ==================================================
:: CONTRARY WHITEBOARD - CLASSIC WINDOWS BUILD SCRIPT
:: ==================================================

:: 1. Environment Setup
if "%VCPKG_ROOT%"=="" set "VCPKG_ROOT=C:\vcpkg"
echo [DEBUG] VCPKG_ROOT is: "%VCPKG_ROOT%"
echo [DEBUG] Qt6_DIR is: "%Qt6_DIR%"
echo [DEBUG] QT_ROOT_DIR is: "%QT_ROOT_DIR%"

if defined Qt6_DIR (
    pushd "%Qt6_DIR%\..\..\.."
    set "QT_ROOT=%CD%"
    popd
) else if defined QT_ROOT_DIR (
    set "QT_ROOT=%QT_ROOT_DIR%"
) else (
    :: Hard fallback for standard GitHub Runner location
    if exist "C:\Qt\6.8.3\msvc2022_64" set "QT_ROOT=C:\Qt\6.8.3\msvc2022_64"
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

:: We will use the local thirdpartydeps folder
set "DEP_PATH=%CD%\thirdpartydeps"

:: Force qmake to use our local dependency paths
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

:: Copy Third-Party DLLs
echo Copying Third-Party DLLs...
xcopy /Y "thirdpartydeps\poppler\bin\*.dll" "%PRODUCT_DIR%\"
xcopy /Y "thirdpartydeps\zlib\1.2.11\bin\*.dll" "%PRODUCT_DIR%\"
xcopy /Y "thirdpartydeps\openssl\openssl-3.0.15-win64\bin\*.dll" "%PRODUCT_DIR%\"
xcopy /Y "thirdpartydeps\quazip\lib\win32\release\*.dll" "%PRODUCT_DIR%\" 2>nul

:: 5. Create Installer
echo [5/5] Compiling Inno Setup installer...
set "ISCC_EXE=iscc"
if not exist "%ISCC_EXE%" (
    if exist "C:\Program Files (x86)\Inno Setup 6\ISCC.exe" (
        set "ISCC_EXE=C:\Program Files (x86)\Inno Setup 6\ISCC.exe"
    )
)

"%ISCC_EXE%" installer\ContraryWhiteboard.iss
if %ERRORLEVEL% neq 0 exit /b %ERRORLEVEL%

echo Done! Installer created in the root directory.
