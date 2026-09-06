import { CustomerAuthError } from "@flo/agent";
import { readFile } from "node:fs/promises";
import { z } from "zod";
import { type CustomerEnrollment, EnrollmentError } from "./customer-enrollment.js";

/** Opt-in enrollment surface; no operator approval endpoint. The existing
 * customer-site Lambda does not mount it. HTTPS origin is a fixed server setting.
 */
export function createEnrollmentHttp(enrollment: Pick<CustomerEnrollment, "start" | "redeem">, publicOrigin: string, fallback: (request: Request, sourceIp: string) => Promise<Response>, assets = new URL("../public/", import.meta.url)) {
  const origin = new URL(publicOrigin);
  if (origin.protocol !== "https:" || origin.origin !== publicOrigin) throw new Error("Canonical HTTPS origin required");
  return async (request: Request, sourceIp: string): Promise<Response> => {
    const path = new URL(request.url).pathname;
    // Served only by this opt-in wrapper, not the existing customer-site handler.
    if (path === "/pairing" || path === "/pairing.js") {
      const headers = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'" };
      if (new URL(request.url).origin !== publicOrigin) return new Response(null, { status: 403, headers });
      if (request.method !== "GET") return new Response(null, { status: 405, headers });
      try {
        const file = path === "/pairing" ? "pairing.html" : "pairing.js";
        return new Response(await readFile(new URL(file, assets), "utf8"), {
          headers: { ...headers, "Content-Type": path === "/pairing" ? "text/html; charset=utf-8" : "text/javascript; charset=utf-8" }
        });
      } catch { return new Response("Pairing is temporarily unavailable.", { status: 503, headers }); }
    }
    if (path !== "/enrollment/request" && path !== "/enrollment/redeem") return fallback(request, sourceIp);
    const headers = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'" };
    const json = (status: number, body: unknown) => Response.json(body, { status, headers });
    if (request.method !== "POST") return json(405, { error: "POST required." });
    if (new URL(request.url).origin !== publicOrigin || request.headers.get("origin") !== publicOrigin) return json(403, { error: "Request origin is not allowed." });
    if (request.headers.get("content-type")?.split(";")[0] !== "application/json") return json(415, { error: "JSON required." });
    const cookies = (request.headers.get("cookie") ?? "").split(/[;,]/).map(value => value.trim()).filter(value => value.startsWith("__Host-flo-session="));
    const session = cookies.length === 1 ? cookies[0]!.slice("__Host-flo-session=".length) : "";
    try {
      const reader = request.body?.getReader();
      const chunks: Uint8Array[] = []; let bytes = 0;
      if (reader) {
        try {
          while (true) {
            const next = await reader.read(); if (next.done) break;
            bytes += next.value.byteLength;
            if (bytes > 2048) { await reader.cancel(); return json(413, { error: "Request too large." }); }
            chunks.push(next.value);
          }
        } finally { reader.releaseLock(); }
      }
      const body: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      const result = path === "/enrollment/request" ? await enrollment.start(session, body) : await enrollment.redeem(session, body);
      return json(200, result);
    } catch (error) {
      if (error instanceof CustomerAuthError) return json(error.status, { code: error.code, error: error.message });
      if (error instanceof EnrollmentError) return json(error.status, { code: "PAIRING_UNAVAILABLE", error: error.message });
      if (error instanceof z.ZodError || error instanceof SyntaxError) return json(400, { error: "Invalid pairing request." });
      return json(503, { error: "Pairing is temporarily unavailable." });
    }
  };
}
