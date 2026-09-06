import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { z } from "zod";
import type { CustomerPrincipal } from "./customer-experience.js";

export class CustomerAuthError extends Error {
  constructor(public readonly status: 401 | 403 | 429 | 503, public readonly code: "SIGN_IN_REQUIRED" | "CUSTOMER_NOT_LINKED" | "SIGN_IN_UNAVAILABLE") {
    super(code === "CUSTOMER_NOT_LINKED" ? "Your Amazon account is not linked to a shop customer. Contact your shop to verify ownership." : code === "SIGN_IN_UNAVAILABLE" ? "Customer sign-in is temporarily unavailable." : "Please sign in to access your repairs.");
  }
}
const unauthorized = () => new CustomerAuthError(401, "SIGN_IN_REQUIRED");
const unavailable = () => new CustomerAuthError(503, "SIGN_IN_UNAVAILABLE");
const digest = (value: string) => createHash("sha256").update(value).digest();
const opaque = () => randomBytes(32).toString("base64url");
const tokenSchema = z.string().min(1).max(2048).regex(/^[\x21-\x7e]+$/);

export interface LwaConfig { clientId: string; clientSecret: string; publicOrigin: string }
export interface LwaProvider {
  exchange(code: string, verifier: string): Promise<{ accessToken: string; expiresIn: number; subject: string }>;
  subject(accessToken: string): Promise<string>;
}
export interface CustomerLinkStore {
  // Trusted operator-controlled records only. No email matching or request-body IDs.
  findCustomer(clientId: string, amazonUserId: string): Promise<string | undefined>;
}
export interface CustomerWebsiteIdentity {
  readonly config: LwaConfig;
  begin(sourceAddress: string, previousBrowserNonce?: string): { browserNonce: string; authorizationUrl: string } | Promise<{ browserNonce: string; authorizationUrl: string }>;
  finish(state: string, browserNonce: string, code: string): Promise<string>;
  principal(session: string): Promise<CustomerPrincipal>;
  logout(session: string): void | Promise<void>;
}

export const validateLwaConfig = (config: LwaConfig): LwaConfig => {
  try {
    const origin = new URL(config.publicOrigin);
    // Treat provider credentials as opaque: current LWA credentials may include
    // a prefix in addition to their payload. 1024 bytes is our configuration
    // safety bound, not an asserted Amazon maximum. Never trim or strip a prefix.
    if (origin.protocol !== "https:" || origin.origin !== config.publicOrigin || origin.username || origin.password || !config.clientId.trim() || Buffer.byteLength(config.clientId, "utf8") > 100 || !/^[\x21-\x7e]+$/.test(config.clientSecret) || Buffer.byteLength(config.clientSecret, "utf8") > 1024) throw unavailable();
    return config;
  } catch { throw unavailable(); }
};

export const createLwaProvider = (config: LwaConfig, request: typeof fetch = fetch): LwaProvider => {
  validateLwaConfig(config);
  const json = async (url: string, init: RequestInit = {}): Promise<unknown> => {
    try {
      const response = await request(url, { ...init, redirect: "error", signal: AbortSignal.timeout(5000) });
      if (!response.ok) throw response.status >= 500 || response.status === 429 ? unavailable() : unauthorized();
      // Do not log URLs, response bodies, codes, tokens or provider exceptions.
      const reader = response.body?.getReader();
      if (!reader) throw unavailable();
      const chunks: Uint8Array[] = []; let size = 0;
      try {
        while (true) {
          const chunk = await reader.read();
          if (chunk.done) break;
          size += chunk.value.byteLength;
          if (size > 32_768) throw unavailable();
          chunks.push(chunk.value);
        }
        return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
      } finally { await reader.cancel().catch(() => undefined); }
    } catch (error) { if (error instanceof CustomerAuthError) throw error; throw unavailable(); }
  };
  const subject = async (accessToken: string): Promise<string> => {
    if (!tokenSchema.safeParse(accessToken).success) throw unauthorized();
    const profile = z.object({ user_id: z.string().min(1).max(256) }).safeParse(await json("https://api.amazon.com/user/profile", { headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" } }));
    if (!profile.success) throw unauthorized();
    return profile.data.user_id;
  };
  return {
    subject,
    exchange: async (code, verifier) => {
      if (code.length < 18 || code.length > 128 || !/^[A-Za-z0-9_-]{43,128}$/.test(verifier)) throw unauthorized();
      const result = z.object({ access_token: tokenSchema, token_type: z.string().regex(/^bearer$/i), expires_in: z.number().int().positive().max(86400) }).safeParse(await json("https://api.amazon.com/auth/o2/token", {
        method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ grant_type: "authorization_code", code, client_id: config.clientId, client_secret: config.clientSecret, redirect_uri: `${config.publicOrigin}/auth/lwa/callback`, code_verifier: verifier }).toString()
      }));
      if (!result.success) throw unauthorized();
      // Amazon documents tokeninfo with the token in the query. Keep this fixed,
      // server-to-server HTTPS request out of access logs and tracing URL capture.
      const infoUrl = new URL("https://api.amazon.com/auth/o2/tokeninfo");
      infoUrl.searchParams.set("access_token", result.data.access_token);
      const info = z.object({ aud: z.string() }).safeParse(await json(infoUrl.href));
      if (!info.success || info.data.aud !== config.clientId) throw unauthorized();
      return { accessToken: result.data.access_token, expiresIn: result.data.expires_in, subject: await subject(result.data.access_token) };
      // Refresh tokens are deliberately not retained by this short-lived website session.
    }
  };
};

const linkFileSchema = z.object({ version: z.literal(1), clientId: z.string().min(1), links: z.array(z.object({ amazonUserId: z.string().min(1).max(256), customerId: z.string().min(1).max(128), active: z.boolean() }).strict()).max(1000) }).strict();
export class FileCustomerLinkStore implements CustomerLinkStore {
  constructor(private readonly file: string) {}
  async findCustomer(clientId: string, amazonUserId: string): Promise<string | undefined> {
    try {
      if ((await stat(this.file)).size > 512_000) throw unavailable();
      const data = linkFileSchema.parse(JSON.parse(await readFile(this.file, "utf8")) as unknown);
      if (data.clientId !== clientId || new Set(data.links.map(link => link.amazonUserId)).size !== data.links.length) throw unavailable();
      return data.links.find(link => link.active && link.amazonUserId === amazonUserId)?.customerId;
    } catch { throw unavailable(); }
  }
}

interface PendingLogin { browserHash: Buffer; verifier: string; expiresAt: number; source: string }
interface WebsiteSession { kind: "website_user"; accessToken: string; subject: string; expiresAt: number }

export class CustomerWebsiteAuth {
  private readonly pending = new Map<string, PendingLogin>();
  private readonly sessions = new Map<string, WebsiteSession>();
  private readonly starts = new Map<string, { count: number; expiresAt: number }>();
  constructor(readonly config: LwaConfig, private readonly provider: LwaProvider, private readonly links: CustomerLinkStore, private readonly now: () => number = Date.now) { validateLwaConfig(config); }

  private clean(): void {
    for (const [key, value] of this.pending) if (value.expiresAt <= this.now()) this.pending.delete(key);
    for (const [key, value] of this.sessions) if (value.expiresAt <= this.now()) this.sessions.delete(key);
    for (const [key, value] of this.starts) if (value.expiresAt <= this.now()) this.starts.delete(key);
  }

  // source must come from the trusted transport, never a browser ID or forwarded header.
  begin(sourceAddress: string, previousBrowserNonce = ""): { browserNonce: string; authorizationUrl: string } {
    this.clean();
    if (!sourceAddress || sourceAddress.length > 128) throw unavailable();
    const source = digest(sourceAddress.replace(/^::ffff:/i, "")).toString("hex");
    const rate = this.starts.get(source);
    if (rate && rate.count >= 20) throw new CustomerAuthError(429, "SIGN_IN_UNAVAILABLE");
    if (!rate && this.starts.size >= 1000) throw unavailable();
    this.starts.set(source, { count: (rate?.count ?? 0) + 1, expiresAt: rate?.expiresAt ?? this.now() + 300_000 });
    const previousHash = digest(previousBrowserNonce);
    for (const [state, login] of this.pending) {
      if (previousBrowserNonce && timingSafeEqual(previousHash, login.browserHash)) this.pending.delete(state);
    }
    if ([...this.pending.values()].filter(login => login.source === source).length >= 5) throw new CustomerAuthError(429, "SIGN_IN_UNAVAILABLE");
    if (this.pending.size >= 1000) throw unavailable();
    const state = opaque(); const browserNonce = opaque(); const verifier = opaque();
    this.pending.set(state, { browserHash: digest(browserNonce), verifier, expiresAt: this.now() + 300_000, source });
    const url = new URL("https://www.amazon.com/ap/oa");
    url.search = new URLSearchParams({ client_id: this.config.clientId, response_type: "code", scope: "profile:user_id", redirect_uri: `${this.config.publicOrigin}/auth/lwa/callback`, state, code_challenge: digest(verifier).toString("base64url"), code_challenge_method: "S256" }).toString();
    return { browserNonce, authorizationUrl: url.href };
  }

  async finish(state: string, browserNonce: string, code: string): Promise<string> {
    this.clean();
    const login = this.pending.get(state);
    if (!login || !timingSafeEqual(login.browserHash, digest(browserNonce))) throw unauthorized();
    this.pending.delete(state); // Single use even if exchange fails or races.
    const identity = await this.provider.exchange(code, login.verifier);
    this.clean();
    if (this.sessions.size >= 1000 || !identity.subject || !Number.isFinite(identity.expiresIn) || identity.expiresIn <= 0) throw unavailable();
    const session = opaque();
    this.sessions.set(digest(session).toString("hex"), { kind: "website_user", ...identity, expiresAt: this.now() + Math.min(identity.expiresIn, 900) * 1000 });
    return session;
  }

  async principal(session: string): Promise<CustomerPrincipal> {
    this.clean();
    const key = digest(session).toString("hex"); const identity = this.sessions.get(key);
    if (!identity || identity.kind !== "website_user") throw unauthorized();
    try {
      if (await this.provider.subject(identity.accessToken) !== identity.subject) throw unauthorized();
    } catch (error) { this.sessions.delete(key); throw error; }
    const customerId = await this.links.findCustomer(this.config.clientId, identity.subject);
    // Logout, revocation and expiry must win over an in-flight provider lookup.
    if (this.sessions.get(key) !== identity || identity.expiresAt <= this.now()) { this.sessions.delete(key); throw unauthorized(); }
    if (!customerId) throw new CustomerAuthError(403, "CUSTOMER_NOT_LINKED");
    return { subject: `lwa:${this.config.clientId}:${identity.subject}`, customerId };
  }

  logout(session: string): void { this.sessions.delete(digest(session).toString("hex")); }
}
