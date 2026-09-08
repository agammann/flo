/* global fetch */
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, chmod, writeFile, readFile, lstat, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { request as httpRequest } from "node:http";
import { URLSearchParams } from "node:url";
import { createPrivateHandoff } from "./private-handoff.mjs";

const synthetic = "A".repeat(43);
async function fixture(t) {
  const directory = await mkdtemp(join(tmpdir(), "flo-handoff-test-")); await chmod(directory, 0o700);
  const app = await createPrivateHandoff({ directory, port: 0 });
  t.after(async () => { await app.close(); await rm(directory, { recursive: true, force: true }); });
  const first = await fetch(app.origin);
  const cookie = first.headers.get("set-cookie").split(";")[0];
  const csrf = (await first.text()).match(/name="csrf" value="([a-f0-9]+)"/)[1];
  const post = (changes = {}, value = synthetic, token = csrf) => fetch(`${app.origin}/request`, { method: "POST", redirect: "manual", headers: { cookie, origin: app.origin, "content-type": "application/x-www-form-urlencoded", ...changes }, body: new URLSearchParams({ csrf: token, requestCode: value }) });
  return { ...app, directory, cookie, post, first };
}
const linux = { skip: process.platform === "win32" ? "POSIX contract runs in Linux Docker and CI" : false };
test("Windows refuses rather than assuming mode bits protect input", async () => {
  if (process.platform === "win32") await assert.rejects(createPrivateHandoff({ directory: "." }), /Linux Docker/);
});
test("captures exactly one request with private permissions and no code in response", linux, async t => {
  const f = await fixture(t); const response = await f.post();
  assert.equal(response.status, 303); assert.equal((await response.text()).includes(synthetic), false);
  const path = join(f.directory, "request.json");
  assert.deepEqual(JSON.parse(await readFile(path, "utf8")), { requestCode: synthetic, confirmation: "approve_designated_pairing" });
  assert.equal((await lstat(path)).mode & 0o777, 0o600);
  assert.equal((await f.post()).status, 409);
});
test("cookie, origin, host, CSRF and input checks fail closed", linux, async t => {
  const f = await fixture(t);
  assert.equal((await f.post({ cookie: "" })).status, 403);
  assert.equal((await f.post({ origin: "https://evil.example" })).status, 403);
  const wrongHost = await new Promise((ok, fail) => {
    const req = httpRequest(f.origin, { headers: { host: "evil.example" } }, res => { res.resume(); res.on("end", () => ok(res.statusCode)); });
    req.on("error", fail); req.end();
  });
  assert.equal(wrongHost, 403);
  assert.equal((await f.post({ "content-type": "text/plain" })).status, 403);
  assert.equal((await f.post({}, synthetic, "bad")).status, 400);
  assert.equal((await f.post({}, '<script>alert(1)</script>')).status, 400);
  assert.equal((await f.post({}, synthetic, "é".repeat(64))).status, 400);
  await assert.rejects(readFile(join(f.directory, "request.json")));
});
test("no framing/caching/CORS; cross-site entry and unauthenticated output denied", linux, async t => {
  const f = await fixture(t);
  assert.equal(f.first.headers.get("cache-control"), "no-store");
  assert.equal(f.first.headers.get("referrer-policy"), "same-origin");
  assert.match(f.first.headers.get("content-security-policy"), /frame-ancestors 'none'/);
  assert.equal(f.first.headers.get("access-control-allow-origin"), null);
  assert.match(f.first.headers.get("set-cookie"), /HttpOnly; SameSite=Strict/);
  assert.equal((await fetch(f.origin, { headers: { "sec-fetch-site": "cross-site" } })).status, 403);
  assert.equal((await fetch(`${f.origin}/invitation`)).status, 403);
});
test("unknown or mismatched output is never presented as approved", linux, async t => {
  const f = await fixture(t); await f.post();
  const get = () => fetch(`${f.origin}/invitation`, { headers: { cookie: f.cookie } });
  assert.equal((await get()).status, 409);
  const path = join(f.directory, "invitation.json");
  await writeFile(path, JSON.stringify({ requestCode: "B".repeat(43), invitation: "C".repeat(43), status: "operator_approved" }), { mode: 0o600 });
  assert.equal((await get()).status, 503);
  await writeFile(path, JSON.stringify({ requestCode: synthetic, invitation: "C".repeat(43), status: "operator_approved" }));
  const response = await get(); assert.equal(response.status, 200);
  assert.match(await response.text(), /No customer link is claimed/);
  await chmod(path, 0o644); assert.equal((await get()).status, 409);
});
test("pre-existing and symlink request outputs never overwrite", linux, async t => {
  const f = await fixture(t);
  await writeFile(join(f.directory, "keep.json"), "preserve", { mode: 0o600 });
  await symlink(join(f.directory, "keep.json"), join(f.directory, "request.json"));
  assert.equal((await f.post()).status, 503);
  assert.equal(await readFile(join(f.directory, "keep.json"), "utf8"), "preserve");
});
test("invalid lifetime and nonprivate directory refuse startup", linux, async t => {
  const f = await fixture(t);
  await assert.rejects(createPrivateHandoff({ directory: f.directory, port: 0, lifetimeMs: 600001 }));
  await chmod(f.directory, 0o755);
  await assert.rejects(createPrivateHandoff({ directory: f.directory, port: 0 }), /Private canonical directory/);
});
