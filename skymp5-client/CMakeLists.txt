project(skymp5-client)

file(GLOB_RECURSE sources ${CMAKE_CURRENT_LIST_DIR}/src/*)

if(BUILD_CLIENT)
  include(${CMAKE_SOURCE_DIR}/cmake/yarn.cmake)

  set(out
    ${CMAKE_BINARY_DIR}/dist/client/Data/Platform/Plugins/skymp5-client.js
  )
  if(WIN32)
    set(turbo_bat "${CMAKE_CURRENT_BINARY_DIR}/turbo_client.bat")
    file(WRITE ${turbo_bat} "yarn turbo run build --filter=skymp5-client")
    add_custom_command(
      OUTPUT ${out}
      COMMAND ${turbo_bat}
      WORKING_DIRECTORY ${CMAKE_SOURCE_DIR}
      DEPENDS ${sources}
    )
  else()
    add_custom_command(
      OUTPUT ${out}
      COMMAND yarn turbo run build --filter=skymp5-client
      WORKING_DIRECTORY ${CMAKE_SOURCE_DIR}
      DEPENDS ${sources}
    )
  endif()
  add_custom_target(skymp5-client ALL
    DEPENDS ${out}
    SOURCES ${sources}
  )

  add_custom_command(
    TARGET skymp5-client POST_BUILD
    COMMAND ${CMAKE_COMMAND} -DCLIENT_SETTINGS_JSON_PATH=${CMAKE_BINARY_DIR}/dist/client/Data/Platform/Plugins/skymp5-client-settings.txt -DOFFLINE_MODE=${OFFLINE_MODE} -P ${CMAKE_SOURCE_DIR}/cmake/scripts/generate_client_settings.cmake
  )
else()
  add_custom_target(skymp5-client ALL
    SOURCES ${source}
    COMMAND ${CMAKE_COMMAND} -E echo "Building skymp5-client is disabled. To enable it, set BUILD_CLIENT to ON."
  )
endif()
