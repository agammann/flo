import test from "node:test";
import assert from "node:assert/strict";
import { invocationDeadline, runHandoffApproval } from "./run-handoff-approval.mjs";
const now = invocationDeadline - 60_000;
function fake(overrides = {}) {
  const calls = [];
  const execute = (binary, args, options) => {
    calls.push({ binary, args, options });
    if (args[0] === "context") return JSON.stringify(overrides.endpoint ?? "npipe:////./pipe/dockerDesktopLinuxEngine");
    if (args[0] === "configure") return JSON.stringify({ Version: 1, AccessKeyId: `ASIA${"A".repeat(16)}`, SecretAccessKey: "SYNTHETIC_SECRET", SessionToken: "SYNTHETIC_SESSION", Expiration: new Date(now + 300_000).toISOString(), ...overrides.credentials });
    if (args[0] === "sts") return JSON.stringify({ Account: "114599789754", UserId: "AIDARVLVOAS5N5MWSFYR5", Arn: "arn:aws:iam::114599789754:user/flo/flo-staging-operator", ...overrides.identity });
    if (args[2] === "inspect") return JSON.stringify({ State: { Running: true }, HostConfig: { ReadonlyRootfs: true, Tmpfs: { "/private": "rw,mode=0700" } }, NetworkSettings: { Ports: { "4311/tcp": [{ HostIp: "127.0.0.1" }] } }, Mounts: [], ...overrides.container });
    if (overrides.failCommand && args.includes("scripts/approve-customer-enrollment.mjs")) throw new Error("synthetic uncertain result");
    return "";
  };
  return { execute, calls };
}
test("exact operator, private env-only credentials and single command", () => {
  const f = fake(); assert.equal(runHandoffApproval("flo-handoff-live-test", f.execute, now).customerRedemptionRequired, true);
  assert.equal(f.calls.length, 6);
  assert.equal(JSON.stringify(f.calls.map(x => x.args)).includes("SYNTHETIC_SECRET"), false);
  assert.equal(f.calls.at(-1).options.env.AWS_SESSION_TOKEN, "SYNTHETIC_SESSION");
  assert.equal(f.calls.at(-2).options.env.AWS_SESSION_TOKEN, undefined);
});
test("root/wrong user, long-term or expired credentials never reach Docker", () => {
  for (const overrides of [{ identity: { Arn: "arn:aws:iam::114599789754:root" } }, { credentials: { AccessKeyId: `AKIA${"A".repeat(16)}` } }, { credentials: { Expiration: new Date(now).toISOString() } }]) {
    const f = fake(overrides); assert.throws(() => runHandoffApproval("flo-handoff-live-test", f.execute, now));
    assert.equal(f.calls.some(x => x.args.includes("exec")), false);
  }
});
test("expired reviewed window and synthetic container name cannot execute", () => {
  const f = fake(); assert.throws(() => runHandoffApproval("flo-handoff-live-test", f.execute, invocationDeadline));
  assert.throws(() => runHandoffApproval("flo-handoff-synthetic-test", f.execute, now)); assert.equal(f.calls.length, 0);
});
test("unexpected isolation and uncertain approval never retry", () => {
  const bad = fake({ container: { HostConfig: { ReadonlyRootfs: false } } });
  assert.throws(() => runHandoffApproval("flo-handoff-live-test", bad.execute, now)); assert.equal(bad.calls.length, 4);
  const uncertain = fake({ failCommand: true }); assert.throws(() => runHandoffApproval("flo-handoff-live-test", uncertain.execute, now));
  assert.equal(uncertain.calls.filter(x => x.args.includes("scripts/approve-customer-enrollment.mjs")).length, 1);
});
test("remote Docker endpoint rejected before exporting credentials", () => {
  const f = fake({ endpoint: "tcp://remote.example:2376" });
  assert.throws(() => runHandoffApproval("flo-handoff-live-test", f.execute, now));
  assert.equal(f.calls.length, 1);
});
