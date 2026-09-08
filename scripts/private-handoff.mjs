import { createServer } from "node:http";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { constants } from "node:fs";
import { lstat, open, realpath } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { URLSearchParams } from "node:url";
import { Buffer } from "node:buffer";
import { setTimeout, clearTimeout } from "node:timers";

const codePattern = /^[A-Za-z0-9_-]{43}$/;
const equal = (a, b) => typeof a === "string" && Buffer.byteLength(a) === Buffer.byteLength(b) && timingSafeEqual(Buffer.from(a), Buffer.from(b));
const headers = {
  // Native form POSTs need a non-null same-origin Origin. No secrets appear in URLs.
  "Cache-Control": "no-store", "Pragma": "no-cache", "Referrer-Policy": "same-origin",
  "Content-Security-Policy": "default-src 'none'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
  "X-Content-Type-Options": "nosniff", "X-Frame-Options": "DENY",
  "Cross-Origin-Resource-Policy": "same-origin", "Content-Type": "text/html; charset=utf-8"
};
const page = content => `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Flo private handoff</title><body><h1>Flo private operator handoff</h1><p>Local staging tool. No AWS credentials. This page cannot approve or link a customer.</p>${content}<p>Never paste credentials, MFA codes or real customer data here. Close the container after the test.</p></body></html>`;

async function privateRead(path) {
  const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || stat.nlink !== 1 || stat.uid !== process.getuid() || (stat.mode & 0o077) || stat.size > 4096) throw new Error("Private file required");
    return JSON.parse(await handle.readFile("utf8"));
  } finally { await handle.close(); }
}

/** Transport only: no SDK, child process, cookie export, authorization or customer mapping. */
export async function createPrivateHandoff({ directory, port = 4311, listenHost = "127.0.0.1", lifetimeMs = 600_000 }) {
  if (process.platform === "win32" || !process.getuid) throw new Error("Run inside isolated Linux Docker");
  directory = resolve(directory);
  const stat = await lstat(directory);
  if (await realpath(directory) !== directory || !stat.isDirectory() || stat.uid !== process.getuid() || (stat.mode & 0o077)) throw new Error("Private canonical directory required");
  if (!Number.isInteger(lifetimeMs) || lifetimeMs < 1 || lifetimeMs > 600_000) throw new Error("Bounded lifetime required");
  const cookie = randomBytes(32).toString("hex");
  const csrf = randomBytes(32).toString("hex");
  let accepted = false;
  let accepting = false;
  let capturedAt = 0;
  const deadline = Date.now() + lifetimeMs;
  let origin;
  const server = createServer(async (request, response) => {
    const send = (status, content, extra = {}) => { response.writeHead(status, { ...headers, ...extra }); response.end(page(content)); };
    try {
      if (request.headers.host !== new URL(origin).host || Date.now() >= deadline) return send(403, "<p>Handoff unavailable.</p>");
      const cookies = (request.headers.cookie ?? "").split(";").map(v => v.trim());
      const authenticated = cookies.some(v => v.startsWith("flo_handoff=") && equal(v.slice(12), cookie));
      if (request.method === "GET" && request.url === "/") {
        if (request.headers["sec-fetch-site"] === "cross-site") return send(403, "<p>Open the local address directly.</p>");
        const body = accepted
          ? '<p>One request captured privately. Operator approval and customer redemption are still required.</p><a href="/invitation">Check private operator output</a>'
          : `<form method="post" action="/request" autocomplete="off"><input type="hidden" name="csrf" value="${csrf}"><label for="requestCode">Private request code</label><input id="requestCode" name="requestCode" type="password" minlength="43" maxlength="43" required autocomplete="off"><button type="submit">Capture this one request</button></form>`;
        return send(200, body, authenticated ? {} : { "Set-Cookie": `flo_handoff=${cookie}; HttpOnly; SameSite=Strict; Path=/; Max-Age=600` });
      }
      if (!authenticated) return send(403, "<p>Local session required.</p>");
      if (request.method === "POST" && request.url === "/request") {
        if (request.headers.origin !== origin || request.headers["content-type"] !== "application/x-www-form-urlencoded") return send(403, "<p>Origin or content type rejected.</p>");
        if (accepted || accepting) return send(409, "<p>One request only. Do not retry an uncertain approval.</p>");
        accepting = true;
        try {
          let body = "";
          for await (const chunk of request) {
            body += chunk.toString("utf8");
            if (Buffer.byteLength(body) > 1024) return send(413, "<p>Input too large.</p>");
          }
          const fields = new URLSearchParams(body);
          if ([...fields].length !== 2 || fields.getAll("csrf").length !== 1 || fields.getAll("requestCode").length !== 1 || !equal(fields.get("csrf"), csrf) || !codePattern.test(fields.get("requestCode") ?? "")) return send(400, "<p>Input rejected.</p>");
          const output = await open(join(directory, "request.json"), constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
          try { await output.writeFile(JSON.stringify({ requestCode: fields.get("requestCode"), confirmation: "approve_designated_pairing" })); await output.sync(); }
          finally { await output.close(); }
          accepted = true; capturedAt = Date.now();
          return send(303, "<p>Captured privately.</p>", { Location: "/" });
        } finally { accepting = false; }
      }
      if (request.method === "GET" && request.url === "/invitation") {
        if (!accepted || Date.now() - capturedAt >= 180_000) return send(409, "<p>No current captured request. The server's request expiry remains authoritative.</p>");
        let data;
        try { data = await privateRead(join(directory, "invitation.json")); }
        catch { return send(409, "<p>No confirmed private output. Do not automatically retry an approval.</p>"); }
        const input = await privateRead(join(directory, "request.json"));
        if (Object.keys(data).sort().join() !== "invitation,requestCode,status" || data.status !== "operator_approved" || !codePattern.test(data.invitation) || !equal(data.requestCode, input.requestCode)) return send(503, "<p>Output binding rejected.</p>");
        return send(200, `<p>Operator approval recorded. No customer link is claimed. Return these codes only to the original Flo session, then explicitly redeem.</p><label for="original">Original request code</label><input id="original" readonly autocomplete="off" value="${data.requestCode}"><label for="invitation">Private invitation</label><input id="invitation" readonly autocomplete="off" value="${data.invitation}"><p>Private codes are visible here. Do not screenshot or record this page.</p>`);
      }
      return send(404, "<p>Not found.</p>");
    } catch { if (!response.headersSent) send(503, "<p>Private handoff unavailable. Do not retry uncertain state.</p>"); else response.end(); }
  });
  server.requestTimeout = 5000; server.headersTimeout = 5000;
  await new Promise((ok, fail) => { server.once("error", fail); server.listen(port, listenHost, ok); });
  origin = `http://127.0.0.1:${server.address().port}`;
  const timer = setTimeout(() => { server.close(); server.closeAllConnections(); }, lifetimeMs);
  timer.unref(); server.on("close", () => clearTimeout(timer));
  return { server, origin, close: () => new Promise(ok => { server.close(ok); server.closeAllConnections(); }) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const running = await createPrivateHandoff({ directory: "/private", listenHost: "0.0.0.0" });
    console.info(`Private handoff ready at ${running.origin}. Ten-minute lifetime. No AWS calls enabled.`);
  } catch { console.error("Private handoff refused startup."); process.exitCode = 1; }
}
