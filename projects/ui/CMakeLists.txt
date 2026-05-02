project(skymp5-front)

if(BUILD_FRONT)
  set(FRONTEND_SOURCE_DIR "${CMAKE_CURRENT_SOURCE_DIR}")
  set(FRONTEND_JS_DEST_DIR "${CMAKE_BINARY_DIR}/dist/client/Data/Platform/UI")

  set(SCRIPT_PATH "${CMAKE_CURRENT_LIST_DIR}/build-local.cmake")
  configure_file(${SCRIPT_PATH} ${CMAKE_BINARY_DIR}/skymp5-front-build.cmake ESCAPE_QUOTES)

  set(source build-local.cmake)

  add_custom_target(skymp5-front ALL
    SOURCES ${source}
    COMMAND ${CMAKE_COMMAND} -E make_directory ${CMAKE_BINARY_DIR}/dist/client
    COMMAND ${CMAKE_COMMAND} -P ${CMAKE_BINARY_DIR}/skymp5-front-build.cmake
    COMMENT "Building skymp5-front from local sources..."
  )
else()
  add_custom_target(skymp5-front ALL
    COMMAND ${CMAKE_COMMAND} -E echo "Building skymp5-front is disabled. To enable it, set BUILD_FRONT to ON."
  )
endif()
