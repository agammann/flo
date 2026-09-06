import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { LambdaClient } from "@aws-sdk/client-lambda";
import { z } from "zod";
import { LambdaEnrollmentApproval } from "./customer-enrollment-approval-invoke.js";

const target = "arn:aws:lambda:us-west-2:123456789012:function:synthetic-approver:1";
const input = { requestCode: "r".repeat(43), confirmation: "approve_designated_pairing" };
const success = { invitation: "i".repeat(43), status: "operator_approved" };
describe("operator invocation capability, simulated SDK only", () => {
  it("sends only a strict confirmation to one exact published version and fails closed on uncertain results", async () => {
    const client = new LambdaClient({ region: "us-west-2", credentials: { accessKeyId: "LOCALTESTONLY", secretAccessKey: "LOCALTESTONLY" }, maxAttempts: 1 });
    let calls = 0; let output: Record<string, unknown> = { StatusCode: 200, Payload: Buffer.from(JSON.stringify({ ok: true, result: success })) };
    client.middlewareStack.add((_next, context) => async args => {
      assert.equal(context.commandName, "InvokeCommand"); calls++;
      const command = z.object({ FunctionName: z.literal(target), InvocationType: z.literal("RequestResponse"), LogType: z.literal("None"), Payload: z.instanceof(Uint8Array) }).parse(args.input);
      assert.deepEqual(JSON.parse(Buffer.from(command.Payload).toString("utf8")), { ...input, version: 1, operation: "approve_designated_fictional_customer" });
      return { response: {}, output: { $metadata: {}, ...output } };
    }, { step: "initialize", name: "approvalInvokeContract", priority: "high" });
    try {
      const invoke = new LambdaEnrollmentApproval(client, target, "123456789012", "us-west-2");
      assert.deepEqual(await invoke.approve(input), success);
      for (const extra of [{ customerId: "customer-b" }, { grants: [] }, { mfaAuthenticated: true }, { verification: {} }]) await assert.rejects(invoke.approve({ ...input, ...extra }));
      assert.equal(calls, 1);
      for (const bad of [{ StatusCode: 202 }, { StatusCode: 200, FunctionError: "Unhandled" }, { StatusCode: 200, Payload: Buffer.alloc(4097) },
        { StatusCode: 200, Payload: Buffer.from("sensitive-invalid-json") }, { StatusCode: 200, Payload: Buffer.from(JSON.stringify({ ok: false, status: 403 })) },
        { StatusCode: 200, Payload: Buffer.from(JSON.stringify({ ok: true, result: { ...success, customerId: "b" } })) }]) {
        output = bad; await assert.rejects(invoke.approve(input), error => error instanceof Error && !error.message.includes("sensitive"));
      }
      assert.equal(calls, 7, "no retry after uncertain or rejected approval");
      for (const arn of [target.replace(":1", ":$LATEST"), target.slice(0, -2), target.replace(":1", ":live"), target.replace("123456789012", "999999999999"), target.replace("us-west-2", "us-east-1")]) {
        assert.throws(() => new LambdaEnrollmentApproval(client, arn, "123456789012", "us-west-2"));
      }
    } finally { client.destroy(); }
  });
});
