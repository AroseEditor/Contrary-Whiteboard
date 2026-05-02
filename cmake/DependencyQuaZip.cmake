# Find QuaZip

find_package(QuaZip-Qt${QT_VERSION} 1.0 QUIET)

if(QuaZip-Qt${QT_VERSION}_FOUND)
    target_link_libraries(${PROJECT_NAME}
        QuaZip::QuaZip
    )
else()
    # Try pkg-config (Linux/macOS)
    find_package(PkgConfig QUIET)

    if(PkgConfig_FOUND)
        pkg_check_modules(QuaZip QUIET IMPORTED_TARGET quazip-qt${QT_VERSION})
        
        if(NOT QuaZip_FOUND)
            pkg_check_modules(QuaZip QUIET IMPORTED_TARGET quazip1-qt${QT_VERSION})
        endif()
        
        if(NOT QuaZip_FOUND)
            pkg_check_modules(QuaZip QUIET IMPORTED_TARGET libquazip${QT_VERSION}-1)
        endif()

        if(NOT QuaZip_FOUND)
            pkg_check_modules(QuaZip QUIET IMPORTED_TARGET quazip${QT_VERSION})
        endif()

        if(QuaZip_FOUND)
            message(STATUS "Found QuaZip version " ${QuaZip_VERSION})
            target_link_libraries(${PROJECT_NAME} 
                PkgConfig::QuaZip
            )
        endif()
    endif()

    if(NOT QuaZip_FOUND)
        # Fallback: look in thirdpartydeps (Windows) or default system paths
        set(QUAZIP_THIRDPARTY "${CMAKE_SOURCE_DIR}/thirdpartydeps/quazip")
        if(EXISTS "${QUAZIP_THIRDPARTY}/quazip")
            message(STATUS "Using thirdpartydeps quazip from ${QUAZIP_THIRDPARTY}")
            # Build quazip from source in thirdpartydeps
            target_include_directories(${PROJECT_NAME} SYSTEM PRIVATE
                "${QUAZIP_THIRDPARTY}"
                "${QUAZIP_THIRDPARTY}/quazip"
            )
            file(GLOB QUAZIP_SOURCES "${QUAZIP_THIRDPARTY}/quazip/*.cpp" "${QUAZIP_THIRDPARTY}/quazip/*.c")
            target_sources(${PROJECT_NAME} PRIVATE ${QUAZIP_SOURCES})
            target_compile_definitions(${PROJECT_NAME} PRIVATE QUAZIP_STATIC)
        else()
            # Last resort: assume default system include directories
            message(STATUS "QuaZip not found, assuming default include directory /usr/include/quazip${QT_VERSION}")
            target_include_directories(${PROJECT_NAME} SYSTEM PRIVATE
                /usr/include/quazip${QT_VERSION}
            )
            target_link_libraries(${PROJECT_NAME}
                quazip${QT_VERSION}
            )
        endif()
    endif()
endif()
