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
            # Add parent directory of poppler include dir to support <poppler/Header.h>
            foreach(inc_dir ${Poppler_INCLUDE_DIRS})
                if(EXISTS "${inc_dir}/poppler")
                    target_include_directories(${PROJECT_NAME} PRIVATE "${inc_dir}")
                else()
                    get_filename_component(parent_dir "${inc_dir}" DIRECTORY)
                    if(EXISTS "${parent_dir}/poppler")
                        target_include_directories(${PROJECT_NAME} PRIVATE "${parent_dir}")
                    endif()
                endif()
            endforeach()
        endif()
        
        # Brute force fix for macOS Homebrew poppler
        if(APPLE)
            execute_process(COMMAND brew --prefix poppler OUTPUT_VARIABLE POPPLER_PREFIX OUTPUT_STRIP_TRAILING_WHITESPACE ERROR_QUIET)
            if(POPPLER_PREFIX)
                message(STATUS "Mac: Adding Poppler include path from brew prefix: ${POPPLER_PREFIX}/include")
                target_include_directories(${PROJECT_NAME} PRIVATE "${POPPLER_PREFIX}/include")
            endif()
            # Also check the common homebrew location directly
            if(EXISTS "/opt/homebrew/include/poppler")
                target_include_directories(${PROJECT_NAME} PRIVATE "/opt/homebrew/include")
            endif()
            if(EXISTS "/usr/local/include/poppler")
                target_include_directories(${PROJECT_NAME} PRIVATE "/usr/local/include")
            endif()
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
