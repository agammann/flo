import { createHash } from "node:crypto";
import { CustomerAuthError } from "@flo/agent";
import { z } from "zod";
import type { AtomicAuthStore, VerifiedEnrollmentIdentity } from "./durable-customer-auth.js";

const denied = () => new CustomerAuthError(401, "SIGN_IN_REQUIRED");
const unavailable = () => new CustomerAuthError(503, "SIGN_IN_UNAVAILABLE");
const hash = (s: string) => createHash("sha256").update(s).digest("hex");
const recordValue = z.object({ kind: z.literal("website_user"), accessToken: z.string().min(1).max(2048), subject: z.string().min(1).max(256) }).strict();

/** Read-only consumer of the existing encrypted website sessions. It cannot
 * exchange codes, mint sessions, link customers, or accept caller-supplied proof. */
export class EnrollmentSessionVerifier {
  private readonly scope: string;
  constructor(private readonly config: { clientId: string; publicOrigin: string }, private readonly store: Pick<AtomicAuthStore, "read">,
    private readonly subject: (token: string) => Promise<string>, private readonly now: () => number = Date.now) {
    const origin = new URL(config.publicOrigin);
    if (origin.protocol !== "https:" || origin.origin !== config.publicOrigin || !config.clientId.trim() || Buffer.byteLength(config.clientId) > 100) throw unavailable();
    this.scope = hash(config.clientId + "\n" + config.publicOrigin);
  }
  async enrollmentIdentity(session: string): Promise<VerifiedEnrollmentIdentity> {
    if (!/^[A-Za-z0-9_-]{43}$/.test(session)) throw denied();
    const key = `${this.scope}:session:${hash(session)}`;
    const row = await this.store.read(key);
    if (!row || row.expiresAt <= this.now()) throw denied();
    const value = recordValue.parse(row.value);
    if (await this.subject(value.accessToken) !== value.subject) throw denied();
    const current = await this.store.read(key);
    if (!current || current.revision !== row.revision || current.expiresAt !== row.expiresAt || current.expiresAt <= this.now()) throw denied();
    return { clientId: this.config.clientId, amazonUserId: value.subject, sessionKey: key, revision: row.revision, expiresAt: row.expiresAt };
  }
}

/** Fixed server-to-server profile endpoint; tokens never enter URLs or logs.
 * Audience was verified by the sign-in service before creating encrypted state. */
export const createEnrollmentSubjectLookup = (request: typeof fetch = fetch) => async (token: string): Promise<string> => {
  if (!/^[\x21-\x7e]{1,2048}$/.test(token)) throw denied();
  try {
    const response = await request("https://api.amazon.com/user/profile", { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" }, redirect: "error", signal: AbortSignal.timeout(5000) });
    if (!response.ok) throw response.status >= 500 || response.status === 429 ? unavailable() : denied();
    const reader = response.body?.getReader(); if (!reader) throw unavailable();
    const chunks: Uint8Array[] = []; let bytes = 0;
    try {
      while (true) {
        const next = await reader.read(); if (next.done) break;
        bytes += next.value.byteLength; if (bytes > 32768) throw unavailable();
        chunks.push(next.value);
      }
      const profile = z.object({ user_id: z.string().min(1).max(256) }).safeParse(JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown);
      if (!profile.success) throw denied();
      return profile.data.user_id;
    } finally { await reader.cancel().catch(() => undefined); }
  } catch (error) { if (error instanceof CustomerAuthError) throw error; throw unavailable(); }
};
