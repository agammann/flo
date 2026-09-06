import { z } from "zod";

export const privateApprovalRequest = z.object({ requestCode: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  confirmation: z.literal("approve_designated_pairing") }).strict();
export const privateApprovalInput = privateApprovalRequest.extend({ version: z.literal(1), operation: z.literal("approve_designated_fictional_customer") });
export const approvalResult = z.object({ invitation: z.string().regex(/^[A-Za-z0-9_-]{43}$/), status: z.literal("operator_approved") }).strict();
export const privateApprovalOutput = z.discriminatedUnion("ok", [z.object({ ok: z.literal(true), result: approvalResult }).strict(),
  z.object({ ok: z.literal(false), status: z.union([z.literal(400), z.literal(403), z.literal(503)]) }).strict()]);
export type PrivateApprovalOutput = z.infer<typeof privateApprovalOutput>;
