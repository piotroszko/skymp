include(${CMAKE_SOURCE_DIR}/tools/cmake/yarn.cmake)

message(STATUS "Writing config.js for frontend")

file(WRITE "${FRONTEND_SOURCE_DIR}/config.js" "")
file(APPEND "${FRONTEND_SOURCE_DIR}/config.js" "module.exports = {\n")
file(APPEND "${FRONTEND_SOURCE_DIR}/config.js" "  outputPath:\n")
file(APPEND "${FRONTEND_SOURCE_DIR}/config.js" "    '${FRONTEND_JS_DEST_DIR}',\n")
file(APPEND "${FRONTEND_SOURCE_DIR}/config.js" "};\n")

message(STATUS "Building frontend")

yarn_execute_command(
    WORKING_DIRECTORY ${CMAKE_SOURCE_DIR}
    COMMAND turbo run build --filter=@skymp/ui
)

message(STATUS "Built frontend")
