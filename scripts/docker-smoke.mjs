import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";

// Run only against a disposable Compose demo, never a live shop.
const base = process.env.FLO_SMOKE_URL ?? "http://127.0.0.1:4200";
let browserHeaders = {};
const request = async (path, body) => {
  const response = await globalThis.fetch(`${base}${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { "content-type": "application/json", ...browserHeaders },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: globalThis.AbortSignal.timeout(15000)
  });
  const result = await response.json();
  assert.equal(response.ok, true, JSON.stringify(result));
  assert.equal(result.ok, true, JSON.stringify(result));
  return result;
};
let health;
for (let attempt = 0; attempt < 60; attempt++) {
  try { health = await request("/api/health"); break; }
  catch (error) { if (attempt === 59) throw error; await delay(1000); }
}
assert.equal(health.protocol, "2025-11-25");
assert.equal(health.toolCount, 28);
const session = await globalThis.fetch(`${base}/api/browser-session`);
assert.equal(session.status, 200);
const { csrfToken } = await session.json();
browserHeaders = { Origin: new URL(base).origin, Cookie: session.headers.getSetCookie()[0].split(';')[0], 'X-Flo-CSRF': csrfToken };
await request("/api/reset", {});
const commands = [
  ["Open work order 1842", "work-order"],
  ["The alternator failed", "job"],
  ["Find compatible replacements under $300 that can arrive tomorrow", "parts"],
  ["Which gives us the best margin without using the cheapest part?", "parts"],
  ["Add it to the estimate and request approval", "estimate"],
  ["Simulate customer approval", "approval"]
];
for (const [command, view] of commands) {
  const result = await request("/api/command", { command });
  assert.equal(result.view, view, command);
  assert.ok(result.invocations.some(call => call.kind === "mcp" && call.ok), command);
  if (command.includes("best margin")) {
    assert.equal(result.data.recommendation.grossPartMarginCents, 10115);
    assert.match(result.voice, /gross part profit in dollars, not margin percentage/);
  }
}
await request("/api/new-conversation", {});
const resumed = await request("/api/command", { command: "What happened with the Ford?" });
assert.match(resumed.voice, /approved/i);
const prepared = await request("/api/command", { command: "Order the alternator and schedule Bay 2 tomorrow morning" });
assert.equal(prepared.view, "confirmation");
assert.ok(prepared.data.confirmationToken);
const completed = await request("/api/command", { command: "Confirm" });
assert.equal(completed.view, "schedule");
assert.equal(completed.data.scheduleSlot.bayId, "bay-2");
assert.ok(completed.invocations.some(call => call.tool === "confirm_transaction" && call.ok));
const ownerStatus = await request("/api/customer/command", { command: "Status of repair 1842", demoConsent: true });
assert.deepEqual(ownerStatus.tools, ["get_my_repair"]);
assert.equal(ownerStatus.data.repairNumber, "1842");
const ownerEstimate = await request("/api/customer/command", { command: "Review estimate 1842", demoConsent: true });
assert.deepEqual(ownerEstimate.tools, ["get_my_estimate"]);
assert.equal(ownerEstimate.data.approvalStatus, "approved");
assert.doesNotMatch(JSON.stringify(ownerEstimate.data), /supplier|markup|margin|shopCost/);
const ownerDenied = await request("/api/customer/command", { command: "Approve repair 1842", demoConsent: true });
assert.deepEqual(ownerDenied.tools, []);
assert.match(ownerDenied.voice, /Nothing has been changed/);
const duplicate = await globalThis.fetch(`${base}/api/command`, {
  method: "POST", headers: { "content-type": "application/json", ...browserHeaders }, body: JSON.stringify({ command: "Confirm" })
});
assert.equal(duplicate.status, 400);
console.log("Demo HTTP smoke passed: real MCP, gross-profit ranking, approval, resumed context, confirmed purchase/schedule, owner-only review, rejected duplicate. Container startup must be verified separately by the runner.");
