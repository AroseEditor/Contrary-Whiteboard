#!/bin/bash
set -e

# ==================================================
# CONTRARY WHITEBOARD - CLASSIC MACOS BUILD SCRIPT
# ==================================================

echo "[1/4] Setting up environment..."
if [ -z "$QT_ROOT" ]; then
    # Guess if not set
    QT_ROOT=$(ls -d /usr/local/Qt/6.*/*/macos 2>/dev/null | head -n 1)
fi

if [ ! -f "$QT_ROOT/bin/qmake" ]; then
    echo "[ERROR] qmake not found at $QT_ROOT/bin"
    exit 1
fi

export PATH="$QT_ROOT/bin:$PATH"

echo "[2/4] Running qmake..."
rm -rf build/macx
qmake ContraryWhiteboard.pro -spec macx-clang "CONFIG+=release"

echo "[3/4] Building with make..."
make -j$(sysctl -n hw.logicalcpu)

echo "[4/4] Deploying and creating DMG..."
APP_BUNDLE="build/macx/release/product/ContraryWhiteboard.app"

if [ -d "$APP_BUNDLE" ]; then
    macdeployqt "$APP_BUNDLE" -dmg
    echo "Done! DMG created in the build folder."
else
    echo "[ERROR] App bundle not found at $APP_BUNDLE"
    exit 1
fi
