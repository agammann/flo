import { createServer } from "node:http";
import { isIP } from "node:net";
import { CustomerAuthError, CustomerExperience, type CustomerWebsiteIdentity } from "@flo/agent";
import type { ShopAdapter } from "@flo/adapters";
import { createCustomerHttp } from "./customer-http.js";

/** Local TLS-proxy adapter only. The Lambda entrypoint has no listener. */
export const createCustomerWebsite = (options: { auth?: CustomerWebsiteIdentity; shop: ShopAdapter; trustedProxyAddresses?: string[] }) => {
  const canonicalIp = (address: string): string => {
    if (!isIP(address)) throw new CustomerAuthError(503, "SIGN_IN_UNAVAILABLE");
    const plain = address.replace(/^::ffff:/i, "");
    return isIP(plain) === 4 ? plain : new URL(`http://[${address}]`).hostname.slice(1, -1);
  };
  const trustedProxies = new Set((options.trustedProxyAddresses ?? []).map(canonicalIp));
  const handler = createCustomerHttp({ ...(options.auth ? { auth: options.auth } : {}), experience: new CustomerExperience(options.shop) });
  const server = createServer((request, response) => {
    void (async () => {
      const peer = canonicalIp(request.socket.remoteAddress ?? "");
      let source = peer;
      if (trustedProxies.has(peer) && request.url?.split("?")[0] === "/auth/lwa/start") {
        const forwarded = request.headers["x-flo-client-ip"];
        if (typeof forwarded !== "string") throw new CustomerAuthError(503, "SIGN_IN_UNAVAILABLE");
        source = canonicalIp(forwarded);
      }
      const headers = new Headers();
      for (const [name, value] of Object.entries(request.headers)) {
        if (value !== undefined) headers.set(name, Array.isArray(value) ? value.join(",") : value);
      }
      const chunks: Buffer[] = []; let size = 0;
      for await (const chunk of request) {
        const buffer = chunk as Buffer; size += buffer.length;
        if (size > 8192) { response.writeHead(413, { "Cache-Control": "no-store" }); response.end(); return; }
        chunks.push(buffer);
      }
      const method = request.method ?? "GET";
      if (!request.url?.startsWith("/") || request.url.startsWith("//")) { response.writeHead(400); response.end(); return; }
      const webRequest = new Request(`http://localhost${request.url}`, { method, headers, ...(!["GET", "HEAD"].includes(method) ? { body: Buffer.concat(chunks) } : {}) });
      const result = await handler(webRequest, source);
      const outputHeaders: Record<string, string | string[]> = Object.fromEntries(result.headers.entries());
      const cookies = result.headers.getSetCookie(); if (cookies.length) outputHeaders["set-cookie"] = cookies;
      response.writeHead(result.status, outputHeaders); response.end(Buffer.from(await result.arrayBuffer()));
    })().catch(() => { if (!response.headersSent) response.writeHead(503, { "Cache-Control": "no-store", "Content-Type": "application/json" }); response.end(JSON.stringify({ error: "Customer sign-in is temporarily unavailable." })); });
  });
  server.requestTimeout = 15_000; server.headersTimeout = 10_000;
  return server;
};
