include(${CMAKE_SOURCE_DIR}/cmake/yarn.cmake)

message(STATUS "Installing yarn dependencies for frontend")

yarn_execute_command(
    WORKING_DIRECTORY ${FRONTEND_SOURCE_DIR}
    COMMAND install
)

message(STATUS "Installed yarn dependencies for frontend")

message(STATUS "Writing config.js for frontend")

file(WRITE "${FRONTEND_SOURCE_DIR}/config.js" "")
file(APPEND "${FRONTEND_SOURCE_DIR}/config.js" "module.exports = {\n")
file(APPEND "${FRONTEND_SOURCE_DIR}/config.js" "  outputPath:\n")
file(APPEND "${FRONTEND_SOURCE_DIR}/config.js" "    '${FRONTEND_JS_DEST_DIR}',\n")
file(APPEND "${FRONTEND_SOURCE_DIR}/config.js" "};\n")

message(STATUS "Building frontend")

yarn_execute_command(
    WORKING_DIRECTORY ${FRONTEND_SOURCE_DIR}
    COMMAND build
)

message(STATUS "Built frontend")
