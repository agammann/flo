import { InvokeCommand, type LambdaClient } from "@aws-sdk/client-lambda";
import { CustomerAuthError } from "@flo/agent";
import { EnrollmentError, redeemInput } from "./customer-enrollment.js";
import { privateRedemptionInput, privateRedemptionOutput } from "./customer-enrollment-protocol.js";

/** Only synchronous invocation of one same-account, same-region published
 * version. No function URL, browser-supplied destination or automatic retry. */
export class LambdaEnrollmentRedemption {
  constructor(private readonly client: Pick<LambdaClient, "send">, private readonly functionArn: string, account: string, region: string) {
    if (!/^\d{12}$/.test(account) || !/^us-(east|west)-[12]$/.test(region) ||
      !new RegExp(`^arn:aws:lambda:${region}:${account}:function:[A-Za-z0-9_-]{1,64}:[1-9][0-9]*$`).test(functionArn)) throw new Error("Exact same-account published redemption version required");
  }
  async redeem(session: string, body: unknown) {
    const input = privateRedemptionInput.parse({ version: 1, operation: "redeem_fictional_customer", session, body: redeemInput.parse(body) });
    let result;
    try {
      const response = await this.client.send(new InvokeCommand({ FunctionName: this.functionArn, InvocationType: "RequestResponse", LogType: "None", Payload: Buffer.from(JSON.stringify(input)) }), { abortSignal: AbortSignal.timeout(9000) });
      if (response.StatusCode !== 200 || response.FunctionError || !response.Payload || response.Payload.byteLength > 4096) throw new Error("Invalid private result");
      result = privateRedemptionOutput.parse(JSON.parse(Buffer.from(response.Payload).toString("utf8")) as unknown);
    } catch { throw new CustomerAuthError(503, "SIGN_IN_UNAVAILABLE"); }
    if (result.ok) return result.result;
    if (result.status === 401) throw new CustomerAuthError(401, "SIGN_IN_REQUIRED");
    if (result.status === 429 || result.status === 503) throw new CustomerAuthError(result.status, "SIGN_IN_UNAVAILABLE");
    throw new EnrollmentError();
  }
}
