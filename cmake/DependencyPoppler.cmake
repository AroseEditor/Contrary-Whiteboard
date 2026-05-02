# Find poppler

find_package(Poppler QUIET COMPONENTS Core Cpp)

if (Poppler_FOUND)
    target_link_libraries(${PROJECT_NAME}
        Poppler::Core
        Poppler::Cpp
    )
else()
    # Try pkg-config (Linux/macOS)
    find_package(PkgConfig QUIET)
    
    if(PkgConfig_FOUND)
        pkg_check_modules(Poppler QUIET IMPORTED_TARGET poppler poppler-cpp)
        
        if (Poppler_FOUND)
            target_link_libraries(${PROJECT_NAME} 
                PkgConfig::Poppler
            )
        endif()
    endif()

    if(NOT Poppler_FOUND)
        # Fallback: look in thirdpartydeps (Windows)
        set(POPPLER_THIRDPARTY "${CMAKE_SOURCE_DIR}/thirdpartydeps/poppler")
        if(EXISTS "${POPPLER_THIRDPARTY}/include")
            message(STATUS "Using thirdpartydeps poppler from ${POPPLER_THIRDPARTY}")
            target_include_directories(${PROJECT_NAME} SYSTEM PRIVATE
                "${POPPLER_THIRDPARTY}/include"
                "${POPPLER_THIRDPARTY}/include/poppler"
                "${POPPLER_THIRDPARTY}/include/poppler/cpp"
            )
            if(CMAKE_BUILD_TYPE STREQUAL "Debug" AND EXISTS "${POPPLER_THIRDPARTY}/debug/lib")
                target_link_directories(${PROJECT_NAME} PRIVATE "${POPPLER_THIRDPARTY}/debug/lib")
            else()
                target_link_directories(${PROJECT_NAME} PRIVATE "${POPPLER_THIRDPARTY}/lib")
            endif()
            target_link_libraries(${PROJECT_NAME} poppler poppler-cpp)
        else()
            message(FATAL_ERROR "Poppler not found. Install poppler or place it in thirdpartydeps/poppler")
        endif()
    endif()
endif()
