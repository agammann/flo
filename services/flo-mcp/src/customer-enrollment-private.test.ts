import assert from "node:assert/strict";
import { chmod, lstat, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { runPrivateEnrollmentApproval } from "./customer-enrollment-private.js";

describe("private operator file boundary (POSIX; Windows explicitly fails closed)", () => {
  const config = { purpose: "fictional_customer_pairing", account: "123456789012", region: "us-west-2",
    functionArn: "arn:aws:lambda:us-west-2:123456789012:function:synthetic-approver:1" };
  const request = { requestCode: "r".repeat(43), confirmation: "approve_designated_pairing" };
  async function fixture(run: (paths: { config: string; request: string; output: string }, root: string) => Promise<void>) {
    const root = await mkdtemp(join(tmpdir(), "flo-private-operator-"));
    const paths = { config: join(root, "config.json"), request: join(root, "request.json"), output: join(root, "invitation.json") };
    try {
      await chmod(root, 0o700);
      await writeFile(paths.config, JSON.stringify(config), { mode: 0o600 });
      await writeFile(paths.request, JSON.stringify(request), { mode: 0o600 });
      await run(paths, root);
    } finally { await rm(root, { recursive: true, force: true }); }
  }
  it("refuses unsupported Windows permissions before invoking the approver", { skip: process.platform !== "win32" }, async () => {
    await assert.rejects(runPrivateEnrollmentApproval({ config: "unused.json", request: "unused.json", output: "unused.json" }, async () => assert.fail("AWS call must not occur")), /POSIX/);
  });
  it("reserves owner-only output before approval and writes no customer identity or credentials", { skip: process.platform === "win32" }, () => fixture(async paths => {
    await runPrivateEnrollmentApproval(paths, async (actualConfig, actualRequest) => {
      assert.deepEqual(actualConfig, config); assert.deepEqual(actualRequest, request);
      assert.equal((await lstat(paths.output)).mode & 0o777, 0o600);
      assert.equal(await readFile(paths.output, "utf8"), "");
      return { invitation: "i".repeat(43), status: "operator_approved" };
    });
    const result = JSON.parse(await readFile(paths.output, "utf8")) as unknown;
    assert.deepEqual(result, { requestCode: request.requestCode, invitation: "i".repeat(43), status: "operator_approved" });
  }));
  it("never overwrites output or retries failed approval", { skip: process.platform === "win32" }, () => fixture(async paths => {
    let calls = 0;
    const fail = async () => { calls++; throw new Error("uncertain transaction"); };
    await assert.rejects(runPrivateEnrollmentApproval(paths, fail));
    assert.equal(await readFile(paths.output, "utf8"), "");
    await assert.rejects(runPrivateEnrollmentApproval(paths, fail));
    assert.equal(calls, 1);
  }));
  it("rejects public permissions, symlinks and malformed inputs before approval", { skip: process.platform === "win32" }, () => fixture(async (paths, root) => {
    const never = async () => assert.fail("AWS call must not occur");
    await chmod(paths.request, 0o644);
    await assert.rejects(runPrivateEnrollmentApproval(paths, never));
    await chmod(paths.request, 0o600);
    const linked = join(root, "linked.json"); await symlink(paths.request, linked);
    await assert.rejects(runPrivateEnrollmentApproval({ ...paths, request: linked }, never));
    await symlink(paths.request, paths.output);
    await assert.rejects(runPrivateEnrollmentApproval(paths, never));
    await writeFile(paths.request, JSON.stringify({ ...request, amazonUserId: "customer-cannot-choose-identity" }));
    await assert.rejects(runPrivateEnrollmentApproval({ ...paths, output: join(root, "new.json") }, never));
    await writeFile(paths.request, JSON.stringify(request));
    const publicDir = join(root, "public"); await mkdir(publicDir, { mode: 0o755 });
    await chmod(publicDir, 0o755);
    await assert.rejects(runPrivateEnrollmentApproval({ ...paths, output: join(publicDir, "new.json") }, never));
  }));
});
