project(skymp5-scripts)

include(${CMAKE_SOURCE_DIR}/tools/cmake/add_papyrus_library_ck.cmake)

if(BUILD_SCRIPTS)
    set(_papyrus_compiler "${SKYRIM_DIR}/Papyrus compiler/PapyrusCompiler.exe")
    add_papyrus_library_ck(
        NAME skymp5-scripts
        DIRECTORY ${CMAKE_CURRENT_LIST_DIR}/psc
        OUTPUT_DIR ${CMAKE_CURRENT_LIST_DIR}/pex
        COMPILER_EXECUTABLE_PATH "${_papyrus_compiler}"
    )

    # Skip the post-build copy when the Papyrus compiler is unavailable
    # (e.g. Linux CI). add_papyrus_library_ck creates a dummy target in
    # that case and the pex/ source dir does not exist — copy_directory
    # would fail.
    if(EXISTS "${_papyrus_compiler}")
        add_custom_command(
            TARGET skymp5-scripts POST_BUILD
            COMMAND ${CMAKE_COMMAND} -E copy_directory ${CMAKE_CURRENT_LIST_DIR}/pex ${CMAKE_BINARY_DIR}/dist/server/data/scripts
        )
    endif()
else()
    add_custom_target(skymp5-scripts ALL
        COMMAND ${CMAKE_COMMAND} -E echo "Building skymp5-scripts is disabled. To enable it, set BUILD_SCRIPTS to ON."
    )
endif()
