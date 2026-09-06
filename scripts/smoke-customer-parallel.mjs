import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";

// One bounded three-request burst against the approved, login-disabled release.
// This is a regression check for asset throttling, not a load/capacity test.
const origin = "https://i4ceh4qpdg.execute-api.us-west-2.amazonaws.com";
assert.equal(process.argv[2], origin, "Explicit approved staging origin required");
const cases = [
  ["/", "62b65ca8f3a90e92892fc60cae6d5cc90168a457179186c1cbd0307dc2372433"],
  ["/signin.css", "a6abcf1047aff331e2b47d5e8d7321d88ddc151a2505b71a60d43d08e8f75ac2"],
  ["/signin.js", "f6bcd232457bd11f67117ba8ef82e562a31ec0659df26ef01e925fa56e442e21"]
];
const startedAt = new Date().toISOString();
const results = await Promise.all(cases.map(async ([path, expectedHash]) => {
  const response = await globalThis.fetch(`${origin}${path}`, {
    redirect: "manual", signal: globalThis.AbortSignal.timeout(15000)
  });
  const bytes = Buffer.from(await response.arrayBuffer());
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const checks = {
    status: response.status === 200,
    byteHash: sha256 === expectedHash,
    noStore: response.headers.get("cache-control") === "no-store",
    noCookies: response.headers.getSetCookie().length === 0,
    noRedirect: response.headers.get("location") === null
  };
  return { path, status: response.status, bytes: bytes.length, sha256,
    requestId: response.headers.get("apigw-requestid"), checks };
}));
console.log(JSON.stringify({ startedAt, endedAt: new Date().toISOString(), results }));
assert.ok(results.every(result => Object.values(result.checks).every(Boolean)), "Parallel assets must match the reviewed release without gateway errors");
console.log("HOSTED_PARALLEL_ASSET_SMOKE_PASS: 3 concurrent GETs; no credentials or customer records.");
