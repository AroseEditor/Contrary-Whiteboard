cmake_minimum_required(VERSION 3.16)

# ==========================================================================
# OpenBoard cmake build file
#
# Most important configuration variables:
#   CMAKE_INSTALL_PREFIX   
#       Path to install prefix, defaults to /usr/local (see cmake documentation)
#       Typically set to /usr or /opt
#   QT_VERSION
#       Qt Version to use
#       Set to empty, 5 or 6, defaults to auto-selection with preference to 5
#
# Typical invocation
#   cmake -S <srcdir> -B <builddir> -DCMAKE_INSTALL_PREFIX:PATH=/usr
#       or
#   cmake -S <srcdir> -B <builddir> -DCMAKE_INSTALL_PREFIX:PATH=/opt
#
# Build
#   cd <builddir>
#   cmake --build . [-j<n>]
#
# Package
#    cpack -G <DEB|RPM>
# ==========================================================================

# ==========================================================================
# Basic project information
# ==========================================================================

include(cmake/Version.cmake)

project(contrarywhiteboard
    VERSION ${VERSION_NUMBER}
    DESCRIPTION "Contrary Whiteboard is a cross-platform interactive whiteboard application for education and presentations. Fork of OpenBoard by AroseEditor."
    HOMEPAGE_URL "https://github.com/AroseEditor/Contrary-Whiteboard"
    LANGUAGES C CXX
)

add_compile_definitions(UBVERSION="${VERSION}")


# ==========================================================================
# Configuration options
# ==========================================================================

set(QT_VERSION "" CACHE STRING "Qt major version number to use - empty, 5 or 6")

# Internal setting
set(QAPPLICATION_CLASS QApplication CACHE STRING "Inheritance class for SingleApplication - do not change")


# ==========================================================================
# Non-source file locations
# ==========================================================================

set(OPENBOARD_QRC_FILE      resources/OpenBoard.qrc)

set(OPENBOARD_FORMS_DIR     resources/forms src/web/simplebrowser)
set(OPENBOARD_TS_DIR        resources/i18n)
set(OPENBOARD_FONT_DIR      resources/customizations resources/fonts)
set(OPENBOARD_ETC_DIR       resources/etc)
set(OPENBOARD_LIBRARY_DIR   resources/library)
set(OPENBOARD_STARTUP_HINTS resources/startupHints)

set(OPENBOARD_ETC_FILE      ${OPENBOARD_ETC_DIR}/OpenBoard.config
                            ${OPENBOARD_ETC_DIR}/OpenBoard.css
                            ${OPENBOARD_ETC_DIR}/widgets.md5sum)
set(OPENBOARD_TEMPLATE_FILE ${OPENBOARD_ETC_DIR}/asyncAPI.js
                            ${OPENBOARD_ETC_DIR}/intranet-podcast-metadata.template
                            ${OPENBOARD_ETC_DIR}/npapi-wrapper.config.xml)

set(OPENBOARD_ICON_FILE     resources/images/ContraryWhiteboard.png)
set(OPENBOARD_DESKTOP_FILE  resources/linux/ch.openboard.OpenBoard.desktop)
set(OPENBOARD_MIMETYPE_FILE resources/linux/ch.openboard.openboard-ubz.xml)
set(OPENBOARD_MIMEICON_FILE resources/linux/ch.openboard.application-ubz.svg)


# ==========================================================================
# Basic compiler settings
# ==========================================================================

set(CMAKE_CXX_STANDARD 17 CACHE STRING "C++ standard to use - defaults to C++17")
set(CMAKE_INCLUDE_CURRENT_DIR ON)
set(CMAKE_AUTOMOC ON)
set(CMAKE_AUTOUIC ON)

list(APPEND CMAKE_AUTOUIC_SEARCH_PATHS 
    ${OPENBOARD_FORMS_DIR}
)

message(STATUS "Using C++" ${CMAKE_CXX_STANDARD})

# OpenMP support
include(FindOpenMP)

if(OPENMP_FOUND)
    string(APPEND CMAKE_CXX_FLAGS " " ${OpenMP_CXX_FLAGS})
endif()


# ==========================================================================
# Target and dependencies
#
# Note: the executable is using lowercase on all platforms
# ==========================================================================

# Fix inconsistent DLL linkage globally
add_definitions(-DQUAZIP_STATIC -DUBCFFADAPTOR_STATIC)

if(APPLE)
    add_executable(${PROJECT_NAME} MACOSX_BUNDLE)
    set_target_properties(${PROJECT_NAME} PROPERTIES
        MACOSX_BUNDLE_GUI_IDENTIFIER "com.aroseeditor.contrarywhiteboard"
        MACOSX_BUNDLE_BUNDLE_NAME "Contrary Whiteboard"
        MACOSX_BUNDLE_BUNDLE_VERSION "${VERSION_NUMBER}"
        MACOSX_BUNDLE_SHORT_VERSION_STRING "${VERSION_NUMBER}"
        MACOSX_BUNDLE_INFO_PLIST "${CMAKE_CURRENT_SOURCE_DIR}/resources/macx/Info.plist"
        MACOSX_BUNDLE_ICON_FILE "OpenBoard.icns"
    )
    # Mark the icon as a resource so it gets copied into the bundle
    set_source_files_properties(resources/macx/OpenBoard.icns PROPERTIES MACOSX_PACKAGE_LOCATION Resources)
    target_sources(${PROJECT_NAME} PRIVATE resources/macx/OpenBoard.icns)
else()
    add_executable(${PROJECT_NAME})
endif()

# manage dependencies (MUST BE AFTER add_executable)
include(cmake/DependencyQt.cmake)
include(cmake/DependencyOpenSSL.cmake)
include(cmake/DependencyPoppler.cmake)
include(cmake/DependencyZlib.cmake)
include(cmake/DependencyQuaZip.cmake)
include(cmake/DependencyFFmpeg.cmake)

# add source path to include directories
target_include_directories(${PROJECT_NAME} PRIVATE
    src
)

# Platform-specific core sources (Added here to ensure visibility)
if(WIN32)
    target_sources(${PROJECT_NAME} PRIVATE
        src/frameworks/UBPlatformUtils_win.cpp
        src/gui/UBKeyboardPalette_win.cpp
    )
    
    # Locate Windows System Libraries
    find_library(WMVCORE_LIB wmvcore)
    find_library(WINMM_LIB winmm)
    find_library(OLE32_LIB ole32)
    find_library(SHELL32_LIB shell32)
    find_library(ADVAPI32_LIB advapi32)
    find_library(STRMIIDS_LIB strmiids)
    find_library(WS2_32_LIB ws2_32)
    find_library(GDI32_LIB gdi32)
    find_library(USER32_LIB user32)
    find_library(MFREADWRITE_LIB mfreadwrite)
    find_library(MFPLAT_LIB mfplat)
    find_library(MF_LIB mf)
    find_library(PROPSYS_LIB propsys)

    target_link_libraries(${PROJECT_NAME}
        ${WMVCORE_LIB}
        ${WINMM_LIB}
        ${OLE32_LIB}
        ${SHELL32_LIB}
        ${ADVAPI32_LIB}
        ${STRMIIDS_LIB}
        ${WS2_32_LIB}
        ${GDI32_LIB}
        ${USER32_LIB}
        ${MFREADWRITE_LIB}
        ${MFPLAT_LIB}
        ${MF_LIB}
        ${PROPSYS_LIB}
        shlwapi.lib
    )
elseif(APPLE)
    target_sources(${PROJECT_NAME} PRIVATE
        src/frameworks/UBPlatformUtils_mac.mm
        src/gui/UBKeyboardPalette_mac.mm
    )
endif()

# add sources from subdirectories
add_subdirectory(src/adaptors)
add_subdirectory(src/api)
add_subdirectory(src/board)
add_subdirectory(src/core)
add_subdirectory(src/desktop)
add_subdirectory(src/document)
add_subdirectory(src/domain)
add_subdirectory(src/frameworks)
add_subdirectory(src/globals)
add_subdirectory(src/gui)
add_subdirectory(src/network)
add_subdirectory(src/pdf)
add_subdirectory(src/pdf-merger)
add_subdirectory(src/podcast)
add_subdirectory(src/singleapplication)
add_subdirectory(src/tools)
add_subdirectory(src/web)
add_subdirectory(plugins/cffadaptor/src)
add_subdirectory(resources/forms)

# statically link singleapplication
target_link_libraries(${PROJECT_NAME}
    SingleApplication::SingleApplication
)

if(WIN32)
    # Ensure Core5Compat is linked for QTextCodec
    target_link_libraries(${PROJECT_NAME} Qt6::Core5Compat)
endif()


# ==========================================================================
# Resources
# ==========================================================================

if(Qt5_VERSION AND Qt5_VERSION VERSION_LESS "5.15")
    qt5_add_resources(OPENBOARD_RESOURCES ${OPENBOARD_QRC_FILE})
else()
    qt_add_resources(OPENBOARD_RESOURCES ${OPENBOARD_QRC_FILE})
endif()

target_sources(${PROJECT_NAME} PRIVATE ${OPENBOARD_RESOURCES})


# ==========================================================================
# Translations
# ==========================================================================

file(GLOB OPENBOARD_TS_FILES ${OPENBOARD_TS_DIR}/*.ts)
set_source_files_properties(${OPENBOARD_TS_FILES} PROPERTIES OUTPUT_LOCATION ${PROJECT_BINARY_DIR}/i18n)

if(Qt5_VERSION AND Qt5_VERSION VERSION_LESS "5.15")
    qt5_add_translation(QM_FILES ${OPENBOARD_TS_FILES})
else()
    qt_add_translation(QM_FILES ${OPENBOARD_TS_FILES})
endif()

target_sources(${PROJECT_NAME} PRIVATE ${QM_FILES} ${OPENBOARD_TS_FILES})


# ==========================================================================
# Installation
# ==========================================================================

include(GNUInstallDirs)

# set relative install paths
if(CMAKE_INSTALL_PREFIX STREQUAL "/opt")
    set(OPENBOARD_INSTALL_SYSCONFDIR ${CMAKE_INSTALL_PREFIX}/${PROJECT_NAME}/etc)
    set(OPENBOARD_INSTALL_DATADIR ${PROJECT_NAME})
    set(CMAKE_INSTALL_BINDIR "/usr/bin")
    set(CMAKE_INSTALL_DATAROOTDIR "/usr/share")
else()
    set(SYSCONF_INSTALL_DIR ${CMAKE_INSTALL_FULL_SYSCONFDIR} CACHE PATH
        "Install directory for system-wide configuration files")
    set(OPENBOARD_INSTALL_SYSCONFDIR ${SYSCONF_INSTALL_DIR}/${PROJECT_NAME})
    set(OPENBOARD_INSTALL_DATADIR ${CMAKE_INSTALL_DATADIR}/${PROJECT_NAME})
endif()

# set absolute install paths
set(OPENBOARD_ETC_PREFIX "${OPENBOARD_INSTALL_SYSCONFDIR}")
set(OPENBOARD_APP_PREFIX "${CMAKE_INSTALL_PREFIX}/${OPENBOARD_INSTALL_DATADIR}")
set(OPENBOARD_TPL_PREFIX "${OPENBOARD_APP_PREFIX}/template")

message(STATUS "OpenBoard ETC_PREFIX is " ${OPENBOARD_ETC_PREFIX})
message(STATUS "OpenBoard APP_PREFIX is " ${OPENBOARD_APP_PREFIX})
message(STATUS "OpenBoard TPL_PREFIX is " ${OPENBOARD_TPL_PREFIX})

target_compile_definitions(${PROJECT_NAME} PRIVATE
    OPENBOARD_FHS_LAYOUT
    OPENBOARD_ETC_PREFIX=${OPENBOARD_ETC_PREFIX}
    OPENBOARD_APP_PREFIX=${OPENBOARD_APP_PREFIX}
    OPENBOARD_TPL_PREFIX=${OPENBOARD_TPL_PREFIX}
)

# Translations
file(GLOB TS_FILES "resources/i18n/ContraryWhiteboard_*.ts")
if(TS_FILES)
    qt6_add_translation(QM_FILES ${TS_FILES})
    add_custom_target(translations ALL DEPENDS ${QM_FILES})
    
    # Ensure QM files are in a known directory for installation
    foreach(QM_FILE ${QM_FILES})
        get_filename_component(QM_NAME ${QM_FILE} NAME)
        add_custom_command(TARGET translations POST_BUILD
            COMMAND ${CMAKE_COMMAND} -E copy ${QM_FILE} ${PROJECT_BINARY_DIR}/i18n/${QM_NAME}
        )
    endforeach()
endif()

# install files
if(APPLE)
    # On macOS, we want everything inside the .app bundle
    install(TARGETS ${PROJECT_NAME} BUNDLE DESTINATION .)
    install(DIRECTORY ${OPENBOARD_FONT_DIR}         DESTINATION contrarywhiteboard.app/Contents/Resources/share)
    install(DIRECTORY ${OPENBOARD_LIBRARY_DIR}      DESTINATION contrarywhiteboard.app/Contents/Resources/share)
    install(DIRECTORY ${OPENBOARD_STARTUP_HINTS}    DESTINATION contrarywhiteboard.app/Contents/Resources/share)
    install(DIRECTORY ${PROJECT_BINARY_DIR}/i18n    DESTINATION contrarywhiteboard.app/Contents/Resources/share)
    install(FILES     ${OPENBOARD_ETC_FILE}         DESTINATION contrarywhiteboard.app/Contents/Resources/etc)
    install(FILES     ${OPENBOARD_TEMPLATE_FILE}    DESTINATION contrarywhiteboard.app/Contents/Resources/share/template)
else()
    # On Windows/Linux, use standard bin/share structure
    install(TARGETS   ${PROJECT_NAME}               RUNTIME DESTINATION bin)
    install(DIRECTORY ${OPENBOARD_FONT_DIR}         DESTINATION share)
    install(DIRECTORY ${OPENBOARD_LIBRARY_DIR}      DESTINATION share)
    install(DIRECTORY ${OPENBOARD_STARTUP_HINTS}    DESTINATION share)
    install(DIRECTORY ${PROJECT_BINARY_DIR}/i18n    DESTINATION share)
    install(FILES     ${OPENBOARD_ETC_FILE}         DESTINATION etc)
    install(FILES     ${OPENBOARD_TEMPLATE_FILE}    DESTINATION share/template)
    
    if(WIN32)
        install(DIRECTORY resources/               DESTINATION share)
    else()
        install(FILES     ${OPENBOARD_ICON_FILE}        DESTINATION ${CMAKE_INSTALL_DATAROOTDIR}/icons/hicolor/scalable/apps)
        install(FILES     ${OPENBOARD_DESKTOP_FILE}     DESTINATION ${CMAKE_INSTALL_DATAROOTDIR}/applications)
        install(FILES     ${OPENBOARD_MIMETYPE_FILE}    DESTINATION ${CMAKE_INSTALL_DATAROOTDIR}/mime/packages)
        install(FILES     ${OPENBOARD_MIMEICON_FILE}    DESTINATION ${CMAKE_INSTALL_DATAROOTDIR}/icons/hicolor/scalable/mimetypes)
    endif()
endif()


# ==========================================================================
# Packaging
# ==========================================================================

include(InstallRequiredSystemLibraries)
set(CPACK_RESOURCE_FILE_LICENSE "${CMAKE_CURRENT_SOURCE_DIR}/LICENSE")
set(CPACK_PACKAGE_VERSION "${VERSION}")
set(CPACK_PACKAGE_CONTACT "AroseEditor <https://github.com/AroseEditor>")
set(CPACK_STRIP_FILES TRUE)

# Debian specific settings
set(CPACK_DEBIAN_FILE_NAME "DEB-DEFAULT")
set(CPACK_DEBIAN_PACKAGE_SUGGESTS onboard)

# RPM specific settings
set(CPACK_RPM_FILE_NAME "RPM-DEFAULT")
set(CPACK_RPM_PACKAGE_SUGGESTS onboard)

# create packager
include(CPack)
