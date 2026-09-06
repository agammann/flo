import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";

// Offline package regression only. Never pass real credentials to this script.
for (const key of ["AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "AWS_SESSION_TOKEN", "LWA_CLIENT_SECRET", "FLO_CUSTOMER_STATE_KEY"]) {
  assert.equal(process.env[key], undefined, `Do not supply ${key} to this isolated smoke test`);
}
Object.assign(process.env, {
  AWS_REGION: "us-west-2", AWS_EC2_METADATA_DISABLED: "true", LWA_ENABLED: "true",
  LWA_CLIENT_ID: "synthetic-package-client", LWA_CLIENT_SECRET: "amzn1.oa2-cs.v1." + "a".repeat(64),
  FLO_CUSTOMER_STATE_KEY: "b".repeat(64), FLO_CUSTOMER_API_ID: "package-test",
  FLO_CUSTOMER_PUBLIC_ORIGIN: "https://package-test.execute-api.us-west-2.amazonaws.com",
  FLO_CUSTOMER_AUTH_TABLE: "synthetic-auth", FLO_CUSTOMER_LINKS_TABLE: "synthetic-links",
  FLO_CUSTOMER_REPAIRS_TABLE: "synthetic-repairs"
});
globalThis.fetch = async () => { throw new Error("Network is forbidden in this package test"); };
const { handler } = await import(pathToFileURL(process.argv[2]).href);
const event = path => ({ version: "2.0", rawPath: path, rawQueryString: "", headers: {}, isBase64Encoded: false,
  requestContext: { apiId: "package-test", stage: "$default", http: { method: "GET", sourceIp: "192.0.2.8" } } });
assert.equal((await handler(event("/"))).statusCode, 200);
const session = await handler(event("/auth/session"));
assert.equal(session.statusCode, 401, "Prefixed configuration must initialize, but an absent session must not authorize access");
assert.equal(JSON.parse(session.body).code, "SIGN_IN_REQUIRED");
assert.equal((await handler(event("/alexa/mcp"))).statusCode, 401);
console.info("LWA_CONFIG_SMOKE_PASS: prefixed synthetic config initializes; absent website session and separate Alexa route denied. Not a provider sign-in or database test.");
