import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { request as httpRequest, type Server } from "node:http";
import express from "express";
import type * as Boundary from "../../apps/alexa-simulator/dist/browser-boundary.js";

describe("simulator browser authority boundary", () => {
  let server: Server; let base: string; let downstream = 0; let clock = 1_800_000_000_000;
  const paths = ["/api/command", "/api/reset", "/api/new-conversation", "/api/customer/command"];
  before(async () => {
    const { createBrowserBoundary } = await import(new URL("../../../apps/alexa-simulator/dist/browser-boundary.js", import.meta.url).href) as typeof Boundary;
    const app = express();
    app.use(createBrowserBoundary({ port: 0, now: () => clock }));
    app.use(express.json());
    for (const path of paths) app.post(path, (_req, res) => { downstream++; res.json({ ok: true }); });
    app.get("/api/health", (_req, res) => res.json({ ok: true }));
    server = app.listen(0, "127.0.0.1"); await new Promise<void>(resolve => server.once("listening", resolve));
    const address = server.address(); assert.ok(address && typeof address !== "string"); base = `http://127.0.0.1:${address.port}`;
  });
  after(async () => { await new Promise<void>(resolve => server.close(() => resolve())); });
  const bootstrap = async () => {
    const response = await fetch(`${base}/api/browser-session`); assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.match(response.headers.getSetCookie()[0]!, /HttpOnly; SameSite=Strict/);
    const { csrfToken } = await response.json() as { csrfToken: string };
    return { Origin: base, Cookie: response.headers.getSetCookie()[0]!.split(";")[0]!, "X-Flo-CSRF": csrfToken };
  };
  const post = (path: string, headers: Record<string, string> = {}) => fetch(`${base}${path}`, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify({ command: "Find compatible replacements" }) });
  it("rejects hostile and malformed Hosts including the token bootstrap and static paths", async () => {
    for (const Host of ["[", "attacker.example", "127.0.0.1.attacker.example", "localhost:1"]) {
      for (const path of ["/api/browser-session", "/", "/shop", "/api/health"]) {
        const status = await new Promise<number>((resolve, reject) => {
          const request = httpRequest(base, { path, headers: { Host, Origin: `http://${Host}` }, agent: false }, response => { response.resume(); response.on("end", () => resolve(response.statusCode!)); });
          request.on("error", reject); request.end();
        });
        assert.equal(status, 403);
      }
    }
    assert.equal((await fetch(`${base}/api/health`)).status, 200);
  });
  it("denies every mutation before downstream execution and permits valid browser sessions", async () => {
    const first = await bootstrap(); const other = await bootstrap(); const before = downstream;
    for (const path of paths) {
      for (const headers of [{}, { Origin: base }, { ...first, Origin: "https://attacker.example" }, { ...first, Origin: "null" }, { ...first, Origin: `${base}/` }, { ...first, Origin: base.replace("http:", "https:") }, { ...first, Cookie: other.Cookie }, { ...first, "X-Flo-CSRF": "invalid" }, { ...first, Cookie: `${first.Cookie}; ${first.Cookie}` }, { ...first, "Sec-Fetch-Site": "cross-site" }]) {
        assert.equal((await post(path, headers)).status, 403);
      }
    }
    assert.equal(downstream, before);
    const denied = await (await post(paths[0]!)).json() as { voice: string; view: string; invocations: unknown[]; data: unknown };
    assert.match(denied.voice, /Nothing has been changed/);
    assert.equal(denied.view, "error"); assert.deepEqual(denied.invocations, []); assert.equal(denied.data, null);
    for (const path of paths) assert.equal((await post(path, first)).status, 200);
    assert.equal(downstream, before + paths.length);
    clock += 3_600_001;
    assert.equal((await post(paths[0]!, first)).status, 403);
    assert.equal(downstream, before + paths.length);
    assert.equal((await post(paths[0]!, await bootstrap())).status, 200);
  });
});
