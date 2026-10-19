// Flo tool arguments are small identifiers and bounded operational text.
// Apply the same byte bound before Node buffering and SDK JSON parsing.
export const MCP_MAX_REQUEST_BYTES = 64 * 1024;
export const MCP_MAX_TOOL_INPUT_ELEMENTS = 1000;
