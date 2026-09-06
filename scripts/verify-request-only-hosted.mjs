import { setTimeout as delay } from "node:timers/promises";
import { performance } from "node:perf_hooks";

// Bounded, credential-free checks only. No login starts, cookies, requests with
// valid sessions, invitations, approvals, model calls or SDK credentials.
const origin = "https://i4ceh4qpdg.execute-api.us-west-2.amazonaws.com";
const json = { Origin: origin, "Content-Type": "application/json" };
const checks = [
  { name: "existing homepage", path: "/", status: 200, contains: "Flo" },
  { name: "pairing page", path: "/pairing", status: 200, contains: "pairing" },
  { name: "pairing script", path: "/pairing.js", status: 200, contains: "/enrollment/request" },
  { name: "no customer session", path: "/auth/session", status: 401 },
  { name: "privacy notice", path: "/privacy", status: 200, contains: "Alexander Ammann" },
  { name: "terms", path: "/terms", status: 200, contains: "Flo" },
  { name: "request without session", path: "/enrollment/request", method: "POST", headers: json, body: '{"consent":true}', status: 401 },
  { name: "request without origin", path: "/enrollment/request", method: "POST", headers: { "Content-Type": "application/json" }, body: '{"consent":true}', status: 403 },
  { name: "request wrong content type", path: "/enrollment/request", method: "POST", headers: { Origin: origin, "Content-Type": "text/plain" }, body: "{}", status: 415 },
  { name: "request invalid schema", path: "/enrollment/request", method: "POST", headers: json, body: "{}", status: 400 },
  { name: "redemption route absent", path: "/enrollment/redeem", method: "POST", headers: json, body: "{}", status: 404 },
  { name: "official Alexa authorization not configured", path: "/alexa/mcp", status: 401 }
];
const results = [];
for (const check of checks) {
  if (results.length) await delay(700);
  const started = performance.now();
  try {
    const response = await globalThis.fetch(origin + check.path, {
      method: check.method ?? "GET", headers: check.headers,
      ...(check.body === undefined ? {} : { body: check.body }),
      credentials: "omit", redirect: "manual", signal: globalThis.AbortSignal.timeout(25_000)
    });
    const body = await response.text();
    const noStore = response.headers.get("cache-control")?.includes("no-store") ?? false;
    const noSniff = response.headers.get("x-content-type-options") === "nosniff";
    const contentMatches = check.contains === undefined || body.includes(check.contains);
    const passed = response.status === check.status && noStore && noSniff && contentMatches;
    results.push({ name: check.name, expected: check.status, actual: response.status, noStore, noSniff, contentMatches, passed, latencyMs: Math.round(performance.now() - started) });
    if (!passed) break; // No retries; unexpected access or failure requires inspection.
  } catch {
    results.push({ name: check.name, passed: false, transportFailure: true });
    break;
  }
}
console.info(JSON.stringify({ time: new Date().toISOString(), maximumRequests: 12, actualRequests: results.length,
  credentialFree: true, passed: results.length === checks.length && results.every(result => result.passed), results }, null, 2));
if (results.length !== checks.length || results.some(result => !result.passed)) process.exitCode = 1;
