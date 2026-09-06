import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { RequestHandler } from "express";

const cookieName = "flo-demo-browser";
const equal = (left: string, right: string): boolean => {
  const a = Buffer.from(left); const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
};

/** Browser isolation for the loopback demo, NOT authentication for public hosting. */
export const createBrowserBoundary = (options: { port: number; now?: () => number }): RequestHandler => {
  const now = options.now ?? Date.now;
  const secret = randomBytes(32);
  const sign = (purpose: string, value: string) => createHmac("sha256", secret).update(`${purpose}:${value}`).digest("base64url");
  return (request, response, next) => {
    const port = options.port || request.socket.localPort;
    const authority = request.headers.host ?? "";
    const origin = `http://${authority}`;
    const denied = () => {
      const message = "Browser request denied. Open the local simulator and reload before retrying. Nothing has been changed.";
      response.status(403).json({ ok: false, error: message, voice: message, view: "error", data: null, invocations: [], tools: [] });
    };
    if (![`127.0.0.1:${port}`, `localhost:${port}`].includes(authority) || (request.headers.origin !== undefined && request.headers.origin !== origin) || request.headers["sec-fetch-site"] === "cross-site") { denied(); return; }
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("Referrer-Policy", "no-referrer");
    response.setHeader("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    const cookies = (request.headers.cookie ?? "").split(";").map(value => value.trim()).filter(value => value.startsWith(`${cookieName}=`));
    const session = cookies.length === 1 ? cookies[0]!.slice(cookieName.length + 1) : "";
    const parts = session.split(".");
    const payload = parts.slice(0, 2).join(".");
    const expires = Number(parts[1]);
    const valid = parts.length === 3 && /^[A-Za-z0-9_-]{43}$/.test(parts[0]!) && /^\d{13}$/.test(parts[1]!) && expires > now() && expires <= now() + 3_600_000 && equal(parts[2]!, sign("session", payload));
    if (request.path === "/api/browser-session" && request.method === "GET") {
      const value = valid ? session : (() => {
        const fresh = `${randomBytes(32).toString("base64url")}.${now() + 3_600_000}`;
        return `${fresh}.${sign("session", fresh)}`;
      })();
      response.setHeader("Cache-Control", "no-store");
      response.setHeader("Vary", "Cookie");
      // HTTP loopback demo only; separate customer authentication uses Secure __Host cookies.
      response.cookie(cookieName, value, { httpOnly: true, sameSite: "strict", path: "/", maxAge: 3_600_000 });
      response.json({ ok: true, csrfToken: sign("csrf", value) }); return;
    }
    if (!["GET", "HEAD"].includes(request.method)) {
      const token = request.headers["x-flo-csrf"];
      if (request.headers.origin !== origin || !valid || typeof token !== "string" || !equal(token, sign("csrf", session))) { denied(); return; }
    }
    next();
  };
};
