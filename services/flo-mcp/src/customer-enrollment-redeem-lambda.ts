import { CustomerAuthError } from "@flo/agent";
import { z } from "zod";
import { CustomerEnrollmentRedemption, EnrollmentError } from "./customer-enrollment.js";
import { DynamoEnrollmentRedeemer } from "./customer-enrollment-dynamodb-redeem.js";
import { linkedResult, privateRedemptionInput, type PrivateRedemptionOutput } from "./customer-enrollment-protocol.js";
import { createEnrollmentRuntime, enrollmentRuntimeConfig } from "./customer-enrollment-runtime.js";

/** Private SDK-invoked Lambda only: no API Gateway route or function URL.
 * Payload fields do not authenticate the invoking service. Deployment IAM must
 * restrict invocation; the original customer session is independently verified. */
export const createPrivateRedemptionLambda = (service: Pick<CustomerEnrollmentRedemption, "redeem">) => async (event: unknown): Promise<PrivateRedemptionOutput> => {
  try {
    const input = privateRedemptionInput.parse(event);
    return { ok: true, result: linkedResult.parse(await service.redeem(input.session, input.body)) };
  } catch (error) {
    if (error instanceof z.ZodError) return { ok: false, status: 400 };
    if (error instanceof CustomerAuthError) return { ok: false, status: error.status };
    if (error instanceof EnrollmentError) return { ok: false, status: 403 };
    return { ok: false, status: 503 };
  }
};
let runtime: ReturnType<typeof createPrivateRedemptionLambda> | undefined;
export const handler = async (event: unknown): Promise<PrivateRedemptionOutput> => {
  if (process.env.FLO_ENROLLMENT_ENABLED !== "true") return { ok: false, status: 503 };
  try {
    if (!runtime) {
      const config = enrollmentRuntimeConfig(process.env);
      const { client, identity } = createEnrollmentRuntime(config);
      runtime = createPrivateRedemptionLambda(new CustomerEnrollmentRedemption(identity, new DynamoEnrollmentRedeemer(client, config.tables)));
    }
    return await runtime(event);
  } catch { return { ok: false, status: 503 }; }
};
