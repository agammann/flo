import { GetCallerIdentityCommand, type STSClient } from "@aws-sdk/client-sts";
import { z } from "zod";
import { EnrollmentError, type EnrollmentOperator } from "./customer-enrollment.js";

const grantSchema = z.object({ operatorId: z.string().min(1).max(128),
  principalArn: z.string().regex(/^arn:aws:iam::\d{12}:(user\/[A-Za-z0-9+=,.@_/-]+|role\/[A-Za-z0-9+=,.@_-]+)$/),
  principalId: z.string().regex(/^(AIDA|AROA)[A-Z0-9]+$/), allowedCustomerIds: z.array(z.string().min(1).max(128)).min(1).max(100)
}).strict();
export type OperatorGrant = z.infer<typeof grantSchema>;

/** Private process only: STS authenticates THIS PROCESS's configured credentials.
 * Never mount this callback in a public customer handler, where it would identify
 * the Lambda service role instead of the caller. Grants must be operator-maintained.
 * STS identity is not itself permission: exact account/ARN/immutable-ID grant required.
 */
export function createStsOperatorAuthorizer(client: Pick<STSClient, "send">, account: string, input: readonly OperatorGrant[]) {
  if (!/^\d{12}$/.test(account)) throw new EnrollmentError();
  const grants = z.array(grantSchema).min(1).parse(input);
  if (grants.some(grant => !grant.principalArn.startsWith(`arn:aws:iam::${account}:`)) || new Set(grants.map(grant => grant.principalArn)).size !== grants.length) throw new EnrollmentError();
  return async (credential: string): Promise<EnrollmentOperator> => {
    if (credential !== "") throw new EnrollmentError(); // No pasted token, header or browser credential accepted.
    const caller = await client.send(new GetCallerIdentityCommand({}), { abortSignal: AbortSignal.timeout(5000) });
    if (caller.Account !== account || !caller.Arn || !caller.UserId) throw new EnrollmentError();
    const assumed = caller.Arn.match(/^arn:aws:sts::(\d{12}):assumed-role\/([A-Za-z0-9+=,.@_-]+)\/([A-Za-z0-9+=,.@_-]+)$/);
    let arn = caller.Arn; let id = caller.UserId;
    if (assumed) {
      if (assumed[1] !== account || !caller.UserId.endsWith(`:${assumed[3]!}`)) throw new EnrollmentError();
      arn = `arn:aws:iam::${account}:role/${assumed[2]!}`; id = caller.UserId.split(":")[0]!;
    }
    const grant = grants.find(item => item.principalArn === arn && item.principalId === id);
    if (!grant) throw new EnrollmentError();
    return { id: grant.operatorId, allowedCustomerIds: [...grant.allowedCustomerIds] };
  };
}
