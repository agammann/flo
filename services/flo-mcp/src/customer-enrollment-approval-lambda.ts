import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { z } from "zod";
import { CustomerEnrollmentApproval, EnrollmentError } from "./customer-enrollment.js";
import { DynamoDesignatedEnrollmentApprover } from "./customer-enrollment-dynamodb-approve.js";
import { hash } from "./customer-enrollment-dynamodb-common.js";
import { privateApprovalInput, approvalResult, type PrivateApprovalOutput } from "./customer-enrollment-approval-protocol.js";

const designationSchema = z.object({ purpose: z.literal("fictional_customer_pairing"),
  customerId: z.string().min(1).max(128), identityKey: hash,
  authorityId: z.string().min(1).max(128), evidenceRef: z.string().trim().min(1).max(256),
  expiresAt: z.number().int().positive() }).strict();

/** Direct synchronous SDK invocation only. IAM must independently restrict the
 * published version to the MFA-protected approver principal. No event/context
 * field proves caller identity/MFA, and STS here would identify the execution role.
 * authorityId records the configured authority, NOT a claimed per-call operator.
 */
export function createPrivateApprovalLambda(service: Pick<CustomerEnrollmentApproval, "approve">, designation: unknown, now: () => number = Date.now) {
  const fixed = designationSchema.parse(designation); // Copy/validate before closure; never reuse caller-owned config.
  return async (event: unknown): Promise<PrivateApprovalOutput> => {
    try {
      const input = privateApprovalInput.parse(event);
      if (fixed.expiresAt <= now()) return { ok: false, status: 403 };
      const result = await service.approve("", { requestCode: input.requestCode, customerId: fixed.customerId,
        verification: { mode: "synthetic_test_designation", evidenceRef: fixed.evidenceRef } });
      return { ok: true, result: approvalResult.parse(result) };
    } catch (error) {
      if (error instanceof z.ZodError) return { ok: false, status: 400 };
      if (error instanceof EnrollmentError) return { ok: false, status: 403 };
      return { ok: false, status: 503 }; // Never emit request codes, invitations, profile data or dependency errors.
    }
  };
}

const table = z.string().regex(/^[A-Za-z0-9_.-]{3,255}$/);
const tableSchema = z.object({ auth: table, requests: table, approvals: table, links: table, audit: table }).strict();
let runtime: ReturnType<typeof createPrivateApprovalLambda> | undefined;
export const handler = async (event: unknown): Promise<PrivateApprovalOutput> => {
  if (process.env.FLO_PRIVATE_APPROVAL_ENABLED !== "true") return { ok: false, status: 503 };
  try {
    if (!runtime) {
      const designation = designationSchema.parse(JSON.parse(process.env.FLO_PRIVATE_APPROVAL_DESIGNATION ?? "null") as unknown);
      const region = z.string().regex(/^us-(east|west)-[12]$/).parse(process.env.AWS_REGION);
      const tables = tableSchema.parse({ auth: process.env.FLO_CUSTOMER_AUTH_TABLE, requests: process.env.FLO_ENROLLMENT_REQUESTS_TABLE,
        approvals: process.env.FLO_ENROLLMENT_APPROVALS_TABLE, links: process.env.FLO_CUSTOMER_LINKS_TABLE, audit: process.env.FLO_ENROLLMENT_AUDIT_TABLE });
      const client = DynamoDBDocumentClient.from(new DynamoDBClient({ region, maxAttempts: 1, requestHandler: { connectionTimeout: 1000, requestTimeout: 2000 } }));
      const adapter = new DynamoDesignatedEnrollmentApprover(client, tables, designation.identityKey);
      const service = new CustomerEnrollmentApproval(adapter, async () => ({ id: designation.authorityId, allowedCustomerIds: [designation.customerId] }));
      runtime = createPrivateApprovalLambda(service, designation);
    }
    return await runtime(event);
  } catch { return { ok: false, status: 503 }; }
};
