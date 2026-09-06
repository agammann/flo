// Both modules refuse remote endpoints and delete only their own random test tables.
await import("../services/flo-mcp/dist/customer-dynamodb-local.js");
await import("../services/flo-mcp/dist/customer-enrollment-dynamodb-local.js");
