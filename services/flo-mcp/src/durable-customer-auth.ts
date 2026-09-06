import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { CustomerAuthError, validateLwaConfig, type CustomerLinkStore, type CustomerPrincipal, type CustomerWebsiteIdentity, type LwaConfig, type LwaProvider } from "@flo/agent";

export interface StoredAuthRecord { revision: string; expiresAt: number; value: unknown }
/** Server-internal proof for enrollment transactions. Never return this to a browser. */
export interface VerifiedEnrollmentIdentity { clientId: string; amazonUserId: string; sessionKey: string; revision: string; expiresAt: number }
/** Strong reads and atomic compare-and-swap are required. Expired records may still exist. */
export interface AtomicAuthStore {
  read(key: string): Promise<StoredAuthRecord | undefined>;
  write(key: string, expectedRevision: string | undefined, record: StoredAuthRecord): Promise<boolean>;
  remove(key: string): Promise<void>;
}
const unavailable = () => new CustomerAuthError(503, "SIGN_IN_UNAVAILABLE");
const unauthorized = () => new CustomerAuthError(401, "SIGN_IN_REQUIRED");
const limited = () => new CustomerAuthError(429, "SIGN_IN_UNAVAILABLE");
const opaque = () => randomBytes(32).toString("base64url");
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const pendingSchema = z.object({ stateHash: z.string(), browserHash: z.string().length(64), verifier: z.string(), expiresAt: z.number() }).strict();
const bucketSchema = z.object({ count: z.number().int().nonnegative(), rateExpiresAt: z.number(), pending: z.array(pendingSchema).max(5) }).strict();
const sessionSchema = z.object({ kind: z.literal("website_user"), accessToken: z.string().min(1).max(2048), subject: z.string().min(1).max(256) }).strict();

/** Durable website identity only; never accepts an Alexa service token or AWS credential. */
export class DurableCustomerWebsiteAuth implements CustomerWebsiteIdentity {
  private readonly scope: string;
  constructor(readonly config: LwaConfig, private readonly provider: LwaProvider, private readonly links: CustomerLinkStore, private readonly store: AtomicAuthStore, private readonly now: () => number = Date.now) {
    validateLwaConfig(config);
    this.scope = hash(config.clientId + "\n" + config.publicOrigin);
  }
  private key(kind: string, value: string): string { return `${this.scope}:${kind}:${value}`; }
  private async update<T>(key: string, operation: (old: StoredAuthRecord | undefined) => { value: unknown; expiresAt: number; result: T }): Promise<T> {
    for (let attempt = 0; attempt < 8; attempt++) {
      const old = await this.store.read(key);
      const next = operation(old);
      if (await this.store.write(key, old?.revision, { revision: opaque(), value: next.value, expiresAt: next.expiresAt })) return next.result;
    }
    throw unavailable(); // Contention/storage faults fail closed; no unbounded retries.
  }
  async begin(sourceAddress: string, previousBrowserNonce = ""): Promise<{ browserNonce: string; authorizationUrl: string }> {
    if (!sourceAddress || sourceAddress.length > 128) throw unavailable();
    const startedAt = this.now();
    // Fixed global admission window bounds storage/provider exposure across instances.
    // Exhaustion denies starts, never disables existing sessions or changes AWS quotas.
    const window = Math.floor(startedAt / 300_000);
    await this.update(this.key("admission", String(window)), old => {
      const count = old ? z.number().int().nonnegative().parse(old.value) : 0;
      if (count >= 1000) throw limited();
      return { value: count + 1, expiresAt: (window + 1) * 300_000, result: undefined };
    });
    // HMAC prevents the state parameter from exposing a dictionary-searchable IP hash.
    const source = createHmac("sha256", this.config.clientSecret).update(sourceAddress.replace(/^::ffff:/i, "")).digest("hex");
    const state = `${source}.${opaque()}`; const browserNonce = opaque(); const verifier = opaque();
    await this.update(this.key("login", source), old => {
      const bucket = old && old.expiresAt > this.now() ? bucketSchema.parse(old.value) : { count: 0, rateExpiresAt: this.now() + 300_000, pending: [] };
      if (bucket.rateExpiresAt <= this.now()) { bucket.count = 0; bucket.rateExpiresAt = this.now() + 300_000; }
      if (bucket.count >= 20) throw limited();
      bucket.pending = bucket.pending.filter(item => item.expiresAt > this.now() && (!previousBrowserNonce || item.browserHash !== hash(previousBrowserNonce)));
      if (bucket.pending.length >= 5) throw limited();
      bucket.count++;
      bucket.pending.push({ stateHash: hash(state), browserHash: hash(browserNonce), verifier, expiresAt: startedAt + 300_000 });
      return { value: bucket, expiresAt: Math.max(bucket.rateExpiresAt, ...bucket.pending.map(item => item.expiresAt)), result: undefined };
    });
    const url = new URL("https://www.amazon.com/ap/oa");
    url.search = new URLSearchParams({ client_id: this.config.clientId, response_type: "code", scope: "profile:user_id", redirect_uri: `${this.config.publicOrigin}/auth/lwa/callback`, state, code_challenge: createHash("sha256").update(verifier).digest("base64url"), code_challenge_method: "S256" }).toString();
    return { browserNonce, authorizationUrl: url.href };
  }
  async finish(state: string, browserNonce: string, code: string): Promise<string> {
    if (!/^[a-f0-9]{64}\.[A-Za-z0-9_-]{43}$/.test(state) || !/^[A-Za-z0-9_-]{43}$/.test(browserNonce)) throw unauthorized();
    const verifier = await this.update(this.key("login", state.split(".")[0]!), old => {
      if (!old || old.expiresAt <= this.now()) throw unauthorized();
      const bucket = bucketSchema.parse(old.value);
      const login = bucket.pending.find(item => item.stateHash === hash(state));
      if (!login || login.expiresAt <= this.now() || !timingSafeEqual(Buffer.from(login.browserHash, "hex"), Buffer.from(hash(browserNonce), "hex"))) throw unauthorized();
      bucket.pending = bucket.pending.filter(item => item !== login);
      return { value: bucket, expiresAt: old.expiresAt, result: login.verifier };
    }); // Atomically consumed before exchange; a retry cannot exchange the code twice.
    const exchangeStartedAt = this.now();
    const identity = await this.provider.exchange(code, verifier);
    const value = sessionSchema.parse({ kind: "website_user", accessToken: identity.accessToken, subject: identity.subject });
    if (!Number.isFinite(identity.expiresIn) || identity.expiresIn <= 0) throw unauthorized();
    const expiresAt = exchangeStartedAt + Math.min(identity.expiresIn, 900) * 1000;
    if (expiresAt <= this.now()) throw unauthorized();
    const session = opaque();
    if (!await this.store.write(this.key("session", hash(session)), undefined, { revision: opaque(), value, expiresAt })) throw unavailable();
    return session;
  }
  async principal(session: string): Promise<CustomerPrincipal> {
    const proof = await this.enrollmentIdentity(session);
    const customerId = await this.links.findCustomer(proof.clientId, proof.amazonUserId);
    const current = await this.store.read(proof.sessionKey);
    if (!current || current.revision !== proof.revision || current.expiresAt <= this.now()) throw unauthorized();
    if (!customerId) throw new CustomerAuthError(403, "CUSTOMER_NOT_LINKED");
    return { subject: `lwa:${proof.clientId}:${proof.amazonUserId}`, customerId };
  }
  async enrollmentIdentity(session: string): Promise<VerifiedEnrollmentIdentity> {
    if (!/^[A-Za-z0-9_-]{43}$/.test(session)) throw unauthorized();
    const key = this.key("session", hash(session));
    const record = await this.store.read(key);
    if (!record || record.expiresAt <= this.now()) throw unauthorized();
    const identity = sessionSchema.parse(record.value);
    try {
      if (await this.provider.subject(identity.accessToken) !== identity.subject) throw unauthorized();
    } catch (error) { await this.store.remove(key); throw error; }
    // Never resurrect a session after logout, expiry or another instance's revocation.
    const current = await this.store.read(key);
    if (!current || current.revision !== record.revision || current.expiresAt <= this.now()) throw unauthorized();
    return { clientId: this.config.clientId, amazonUserId: identity.subject, sessionKey: key, revision: record.revision, expiresAt: record.expiresAt };
  }
  async logout(session: string): Promise<void> {
    if (/^[A-Za-z0-9_-]{43}$/.test(session)) await this.store.remove(this.key("session", hash(session)));
  }
}
