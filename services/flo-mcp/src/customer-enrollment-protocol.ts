import { z } from "zod";
import { redeemInput } from "./customer-enrollment.js";

export const privateRedemptionInput = z.object({ version: z.literal(1), operation: z.literal("redeem_fictional_customer"), session: z.string().regex(/^[A-Za-z0-9_-]{43}$/), body: redeemInput }).strict();
export const linkedResult = z.object({ linked: z.literal(true), scope: z.literal("fictional_staging_customer") }).strict();
export const privateRedemptionOutput = z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(true), result: linkedResult }).strict(),
  z.object({ ok: z.literal(false), status: z.union([z.literal(400), z.literal(401), z.literal(403), z.literal(429), z.literal(503)]) }).strict()
]);
export type PrivateRedemptionOutput = z.infer<typeof privateRedemptionOutput>;
