#!/bin/bash
set -e

# ========================================
# CONTRARY WHITEBOARD - MACOS BUILD SCRIPT
# ========================================

echo "[1/4] Checking environment..."

# 1. Setup paths
if [ -n "$Qt6_DIR" ]; then
    QT_DIR="$Qt6_DIR/.."
elif [ -d "$HOME/Qt/6.8.3/macos" ]; then
    QT_DIR="$HOME/Qt/6.8.3/macos"
elif [ -d "/usr/local/opt/qt" ]; then
    QT_DIR="/usr/local/opt/qt"
elif [ -d "/opt/homebrew/opt/qt" ]; then
    QT_DIR="/opt/homebrew/opt/qt"
else
    echo "[ERROR] Qt not found. Please set Qt6_DIR or install Qt."
    exit 1
fi

echo "Using Qt at: $QT_DIR"

# Export PKG_CONFIG_PATH for Homebrew libraries
export PKG_CONFIG_PATH="/opt/homebrew/lib/pkgconfig:/opt/homebrew/opt/openssl@3/lib/pkgconfig:/opt/homebrew/opt/ffmpeg/lib/pkgconfig:$PKG_CONFIG_PATH"
export PKG_CONFIG_PATH="/usr/local/lib/pkgconfig:/usr/local/opt/openssl@3/lib/pkgconfig:/usr/local/opt/ffmpeg/lib/pkgconfig:$PKG_CONFIG_PATH"

# 2. Configure CMake
echo "[2/4] Configuring CMake..."
rm -rf build dist
cmake -S . -B build \
    -DCMAKE_PREFIX_PATH="$QT_DIR" \
    -DQT_VERSION=6 \
    -DCMAKE_BUILD_TYPE=Release \
    -DCMAKE_OSX_ARCHITECTURES="x86_64;arm64"

# 3. Build
echo "[3/4] Compiling..."
cmake --build build --config Release --parallel $(sysctl -n hw.logicalcpu)

# 4. Stage and Deploy (macdeployqt)
echo "[4/4] Staging files & packaging DMG..."
APP_BUNDLE=$(find build -name "*.app" -not -path "*/Qt*" -not -path "*/qt*" | head -1)

if [ -z "$APP_BUNDLE" ]; then
    echo "[ERROR] No .app bundle found in build directory."
    exit 1
fi

echo "Found application bundle: $APP_BUNDLE"
mkdir -p dist
cp -R "$APP_BUNDLE" "dist/ContraryWhiteboard.app"

# Use macdeployqt
"$QT_DIR/bin/macdeployqt" "dist/ContraryWhiteboard.app" -dmg -always-overwrite

# Version extraction
VERSION="1.0.0"
if [ -f version.txt ]; then
    MAJ=$(grep 'VERSION_MAJ' version.txt | cut -d= -f2 | tr -d ' \r ')
    MIN=$(grep 'VERSION_MIN' version.txt | cut -d= -f2 | tr -d ' \r ')
    PAT=$(grep 'VERSION_PATCH' version.txt | cut -d= -f2 | tr -d ' \r ')
    VERSION="$MAJ.$MIN.$PAT"
fi

mv "dist/ContraryWhiteboard.dmg" "ContraryWhiteboard-$VERSION-macOS.dmg"

echo ""
echo "=============================================="
echo "[SUCCESS] Build complete!"
echo "DMG Installer: ContraryWhiteboard-$VERSION-macOS.dmg"
echo "=============================================="
