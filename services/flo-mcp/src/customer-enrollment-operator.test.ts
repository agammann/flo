import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { STSClient } from "@aws-sdk/client-sts";
import { createStsOperatorAuthorizer } from "./customer-enrollment-operator.js";

// Local SDK response contracts only; no AWS credentials or network calls.
const account = "123456789012";
const grant = { operatorId: "test-shop-operator", principalArn: `arn:aws:iam::${account}:role/FloOperator`, principalId: "AROAEXAMPLE123", allowedCustomerIds: ["staging-customer-a"] };
const caller = { Account: account, Arn: `arn:aws:sts::${account}:assumed-role/FloOperator/operator-session`, UserId: "AROAEXAMPLE123:operator-session", $metadata: {} };
describe("private enrollment operator STS identity and explicit authorization", () => {
  it("checks fresh STS identity against account, role and immutable principal ID", async () => {
    const client = new STSClient({ region: "us-west-2" }); let calls = 0;
    client.send = async () => { calls++; return caller; };
    const authorize = createStsOperatorAuthorizer(client, account, [grant]);
    assert.deepEqual(await authorize(""), { id: grant.operatorId, allowedCustomerIds: ["staging-customer-a"] });
    await authorize(""); assert.equal(calls, 2);
    client.destroy();
  });
  it("denies service roles, root, recreated roles, wrong accounts and inconsistent identity", async () => {
    const client = new STSClient({ region: "us-west-2" });
    for (const change of [
      { Account: "000000000000" }, { Arn: `arn:aws:iam::${account}:root`, UserId: account },
      { Arn: `arn:aws:sts::${account}:assumed-role/FloCustomerLambda/operator-session` },
      { UserId: "AROARECREATED:operator-session" }, { UserId: "AROAEXAMPLE123:other-session" }, { Arn: "" }
    ]) {
      client.send = async () => ({ ...caller, ...change });
      await assert.rejects(createStsOperatorAuthorizer(client, account, [grant])(""));
    }
    client.destroy();
  });
  it("never accepts a caller token or wildcard grants and fails closed on STS errors", async () => {
    const client = new STSClient({ region: "us-west-2" }); let called = false;
    client.send = async () => { called = true; throw new Error("STS unavailable"); };
    const authorize = createStsOperatorAuthorizer(client, account, [grant]);
    for (const token of ["website-session", "AWS4-HMAC-SHA256", "Administrator"]) await assert.rejects(authorize(token));
    assert.equal(called, false); await assert.rejects(authorize(""));
    assert.throws(() => createStsOperatorAuthorizer(client, account, [{ ...grant, principalArn: "*" }]));
    assert.throws(() => createStsOperatorAuthorizer(client, account, [grant, grant]));
    client.destroy();
  });
});
