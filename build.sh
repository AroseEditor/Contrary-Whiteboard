#!/bin/bash
# ===========================================================================
# Contrary Whiteboard - macOS / Linux Build + Package Script
#
# Usage:
#   ./build.sh [platform] [type]
#
#   platform: macos | linux (default: auto-detect)
#   type:     Release | Debug (default: Release)
#
# macOS output:  install/macos/ContraryWhiteboard-<version>.dmg
# Linux output:  install/linux/contrarywhiteboard_<version>_amd64.deb
#                install/linux/contrarywhiteboard-<version>.x86_64.rpm
# ===========================================================================
set -euo pipefail

# ----------- CONFIGURE THESE -----------
QT_DIR_MACOS="${HOME}/Qt/6.9.0/macos"
QT_DIR_LINUX="${HOME}/Qt/6.9.0/gcc_64"   # or leave empty to use system Qt
# ---------------------------------------

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BUILD_TYPE="${2:-Release}"
PLATFORM="${1:-}"

# Auto-detect platform
if [[ -z "$PLATFORM" ]]; then
    case "$(uname -s)" in
        Darwin) PLATFORM="macos" ;;
        Linux)  PLATFORM="linux" ;;
        *)      echo "[ERROR] Unknown platform: $(uname -s)"; exit 1 ;;
    esac
fi

# ----------- Parse version.txt -----------
parse_version() {
    local key="$1"
    awk -F'=' "/^${key}/"'{gsub(/ /,"",$2); sub(/#.*/,"",$2); gsub(/\r/,"",$2); print $2}' \
        "$SCRIPT_DIR/version.txt"
}

VERSION_MAJ=$(parse_version "VERSION_MAJ")
VERSION_MIN=$(parse_version "VERSION_MIN")
VERSION_PATCH=$(parse_version "VERSION_PATCH")
VERSION_TYPE=$(parse_version "VERSION_TYPE")
APP_VERSION="${VERSION_MAJ}.${VERSION_MIN}.${VERSION_PATCH}"
[[ "$VERSION_TYPE" != "r" ]] && APP_VERSION="${APP_VERSION}-${VERSION_TYPE}"

echo ""
echo "============================================"
echo " Contrary Whiteboard Build"
echo " Platform: $PLATFORM | Config: $BUILD_TYPE"
echo " Version:  $APP_VERSION"
echo "============================================"
echo ""

BUILD_DIR="$SCRIPT_DIR/build/$PLATFORM/$BUILD_TYPE"
STAGE_DIR="$BUILD_DIR/staged"

# ===========================================================================
# macOS
# ===========================================================================
build_macos() {
    local QT_DIR="${QT_DIR_MACOS}"
    local MACDEPLOYQT="${QT_DIR}/bin/macdeployqt"
    local CMAKE_PREFIX="${QT_DIR}"
    local PRODUCT_DIR="$SCRIPT_DIR/install/macos"
    local APP_BUNDLE="$STAGE_DIR/contrarywhiteboard.app"

    # Validate
    [[ ! -x "${QT_DIR}/bin/qmake" ]] && { echo "[ERROR] Qt not found at $QT_DIR"; exit 1; }
    command -v cmake &>/dev/null || { echo "[ERROR] cmake not found"; exit 1; }
    command -v hdiutil &>/dev/null || { echo "[ERROR] hdiutil not found (not macOS?)"; exit 1; }

    echo "[1/4] CMake configure..."
    mkdir -p "$BUILD_DIR"
    cmake -S "$SCRIPT_DIR" -B "$BUILD_DIR" \
        -DCMAKE_BUILD_TYPE="$BUILD_TYPE" \
        -DCMAKE_PREFIX_PATH="$CMAKE_PREFIX" \
        -DCMAKE_INSTALL_PREFIX="$STAGE_DIR"

    echo "[2/4] Build..."
    cmake --build "$BUILD_DIR" --config "$BUILD_TYPE" -j"$(sysctl -n hw.logicalcpu)"

    echo "[3/4] Install + macdeployqt..."
    cmake --install "$BUILD_DIR" --config "$BUILD_TYPE"

    # macdeployqt bundles Qt frameworks and signs the .app
    "$MACDEPLOYQT" "$APP_BUNDLE" \
        -dmg \
        -always-overwrite \
        -no-strip
    # macdeployqt drops a .dmg next to the .app — move it to product dir
    mkdir -p "$PRODUCT_DIR"
    local MACDEPLOYQT_DMG="${APP_BUNDLE%.app}.dmg"
    local FINAL_DMG="$PRODUCT_DIR/ContraryWhiteboard-${APP_VERSION}.dmg"

    if [[ -f "$MACDEPLOYQT_DMG" ]]; then
        mv "$MACDEPLOYQT_DMG" "$FINAL_DMG"
    else
        # fallback: build DMG manually with hdiutil
        echo "  macdeployqt didn't produce DMG directly, building with hdiutil..."
        local SPARSE="$BUILD_DIR/ContraryWhiteboard.sparseimage"
        [[ -f "$SPARSE" ]] && rm "$SPARSE"

        hdiutil create -size 512m -type SPARSE -fs HFS+ \
            -volname "Contrary Whiteboard" "$SPARSE"
        hdiutil attach "$SPARSE" -mountpoint /Volumes/ContraryWhiteboard

        rsync -a "$APP_BUNDLE" /Volumes/ContraryWhiteboard/
        ln -sf /Applications /Volumes/ContraryWhiteboard/Applications

        hdiutil detach /Volumes/ContraryWhiteboard
        hdiutil convert "$SPARSE" -format UDZO -o "$FINAL_DMG"
        rm "$SPARSE"
    fi

    echo "[4/4] Done."
    echo ""
    echo "  DMG: $FINAL_DMG"
}

# ===========================================================================
# Linux
# ===========================================================================
build_linux() {
    local CMAKE_ARGS=()
    local PRODUCT_DIR="$SCRIPT_DIR/install/linux"

    # Use custom Qt if specified and exists
    if [[ -n "$QT_DIR_LINUX" && -d "$QT_DIR_LINUX" ]]; then
        CMAKE_ARGS+=("-DCMAKE_PREFIX_PATH=${QT_DIR_LINUX}")
        echo "  Using Qt at $QT_DIR_LINUX"
    else
        echo "  Using system Qt"
    fi

    command -v cmake &>/dev/null || { echo "[ERROR] cmake not found"; exit 1; }

    echo "[1/4] CMake configure..."
    mkdir -p "$BUILD_DIR"
    cmake -S "$SCRIPT_DIR" -B "$BUILD_DIR" \
        -DCMAKE_BUILD_TYPE="$BUILD_TYPE" \
        -DCMAKE_INSTALL_PREFIX=/usr \
        "${CMAKE_ARGS[@]}"

    echo "[2/4] Build..."
    cmake --build "$BUILD_DIR" --config "$BUILD_TYPE" -j"$(nproc)"

    echo "[3/4] CPack (DEB + RPM)..."
    mkdir -p "$PRODUCT_DIR"
    cd "$BUILD_DIR"

    # DEB
    if command -v dpkg &>/dev/null || command -v dpkg-deb &>/dev/null; then
        cpack -G DEB -B "$PRODUCT_DIR"
        echo "  DEB: $(ls "$PRODUCT_DIR"/*.deb 2>/dev/null | head -1)"
    else
        echo "  [SKIP] dpkg not available, skipping DEB"
    fi

    # RPM
    if command -v rpmbuild &>/dev/null; then
        cpack -G RPM -B "$PRODUCT_DIR"
        echo "  RPM: $(ls "$PRODUCT_DIR"/*.rpm 2>/dev/null | head -1)"
    else
        echo "  [SKIP] rpmbuild not available, skipping RPM"
    fi

    # AppImage (bonus — needs linuxdeployqt or appimagetool)
    if command -v linuxdeployqt &>/dev/null; then
        echo "[4/4] Building AppImage..."
        local APPDIR="$BUILD_DIR/AppDir"
        cmake --install "$BUILD_DIR" --config "$BUILD_TYPE" \
            --prefix "$APPDIR/usr"

        linuxdeployqt "$APPDIR/usr/bin/contrarywhiteboard" \
            -appimage \
            -no-translations \
            -bundle-non-qt-libs

        local AI
        AI=$(find "$BUILD_DIR" -name "*.AppImage" | head -1)
        [[ -n "$AI" ]] && mv "$AI" "$PRODUCT_DIR/ContraryWhiteboard-${APP_VERSION}-x86_64.AppImage"
        echo "  AppImage: $PRODUCT_DIR/ContraryWhiteboard-${APP_VERSION}-x86_64.AppImage"
    else
        echo "[4/4] (AppImage skipped — linuxdeployqt not in PATH)"
    fi

    cd "$SCRIPT_DIR"
    echo ""
    echo "  Packages in: $PRODUCT_DIR"
}

# ===========================================================================
# Dispatch
# ===========================================================================
case "$PLATFORM" in
    macos)  build_macos ;;
    linux)  build_linux ;;
    *)
        echo "[ERROR] Unknown platform: $PLATFORM"
        echo "  Usage: $0 [macos|linux] [Release|Debug]"
        exit 1
        ;;
esac

echo ""
echo "============================================"
echo " Build complete: $PLATFORM $APP_VERSION"
echo "============================================"
