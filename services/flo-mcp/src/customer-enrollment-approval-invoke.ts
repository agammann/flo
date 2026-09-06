import { InvokeCommand, type LambdaClient } from "@aws-sdk/client-lambda";
import { EnrollmentError } from "./customer-enrollment.js";
import { privateApprovalRequest, privateApprovalOutput } from "./customer-enrollment-approval-protocol.js";

/** Invocation capability only; IAM independently limits the destination and MFA.
 * This class does not accept grants, customer IDs, tables or claimed caller identity. */
export class LambdaEnrollmentApproval {
  constructor(private readonly client: Pick<LambdaClient, "send">, private readonly functionArn: string, account: string, region: string) {
    if (!/^\d{12}$/.test(account) || !/^us-(east|west)-[12]$/.test(region) ||
      !new RegExp(`^arn:aws:lambda:${region}:${account}:function:[A-Za-z0-9_-]{1,64}:[1-9][0-9]*$`).test(functionArn)) throw new Error("Exact same-account published approval version required");
  }
  async approve(body: unknown) {
    const input = { ...privateApprovalRequest.parse(body), version: 1, operation: "approve_designated_fictional_customer" };
    let result;
    try {
      const response = await this.client.send(new InvokeCommand({ FunctionName: this.functionArn, InvocationType: "RequestResponse", LogType: "None", Payload: Buffer.from(JSON.stringify(input)) }), { abortSignal: AbortSignal.timeout(9000) });
      if (response.StatusCode !== 200 || response.FunctionError || !response.Payload || response.Payload.byteLength > 4096) throw new Error("Invalid private result");
      result = privateApprovalOutput.parse(JSON.parse(Buffer.from(response.Payload).toString("utf8")) as unknown);
    } catch { throw new EnrollmentError(503); }
    if (!result.ok) throw new EnrollmentError(result.status);
    return result.result;
  }
}
