include(${CMAKE_SOURCE_DIR}/tools/cmake/yarn.cmake)

file(GLOB_RECURSE sources ${CMAKE_CURRENT_LIST_DIR}/*.ts)

set(out
  ${CMAKE_BINARY_DIR}/dist/server/dist_back/skymp5-server.js
)

if(WIN32)
  set(turbo_bat "${CMAKE_CURRENT_BINARY_DIR}/turbo_server.bat")
  file(WRITE ${turbo_bat} "yarn turbo run build --filter=skymp5-server")
  add_custom_command(
    OUTPUT ${out}
    COMMAND ${turbo_bat}
    WORKING_DIRECTORY ${CMAKE_SOURCE_DIR}
    DEPENDS ${sources}
  )
else()
  add_custom_command(
    OUTPUT ${out}
    COMMAND yarn turbo run build --filter=skymp5-server
    WORKING_DIRECTORY ${CMAKE_SOURCE_DIR}
    DEPENDS ${sources}
  )
endif()

add_custom_target(skymp5-server-ts ALL
  DEPENDS ${out}
  SOURCES ${sources}
)
