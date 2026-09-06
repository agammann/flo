import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { principal, table, requestKey, attributes, kmsConstraints } from "./pairing-verifier-access-plan.mjs";

// Offline fixtures for AWS SimulateCustomPolicy. No runtime API calls or keys.
export function verifierSimulationCases(deadline) {
  const now = new Date(new Date(deadline).getTime() - 60_000).toISOString();
  const common = { "aws:PrincipalArn": ["string", [principal]],
    "aws:RequestedRegion": ["string", ["us-west-2"]], "aws:CurrentTime": ["date", [now]] };
  const data = { ...common, "aws:MultiFactorAuthPresent": ["boolean", ["true"]],
    "aws:MultiFactorAuthAge": ["numeric", ["1"]],
    "dynamodb:Attributes": ["stringList", attributes], "dynamodb:LeadingKeys": ["stringList", ["a".repeat(64)]] };
  const kms = { ...common, ...Object.fromEntries(Object.entries(kmsConstraints).map(([k, v]) => [k, ["string", [v]]])) };
  const rows = [];
  function add(name, action, resource, context, expected = "explicitDeny", patch = {}) {
    const c = { ...globalThis.structuredClone(context), ...patch };
    for (const k of Object.keys(c)) if (c[k] === null) delete c[k];
    rows.push({ name, action, resource, expected,
      context: Object.entries(c).map(([ContextKeyName, [ContextKeyType, ContextKeyValues]]) => ({ ContextKeyName, ContextKeyType, ContextKeyValues })) });
  }
  add("data-allow", "dynamodb:GetItem", table, data, "allowed");
  add("data-allow-specific-select", "dynamodb:GetItem", table, data, "allowed", { "dynamodb:Select": ["string", ["SPECIFIC_ATTRIBUTES"]] });
  add("kms-allow-service-mediated", "kms:Decrypt", requestKey, kms, "allowed");
  add("data-other-table", "dynamodb:GetItem", `${table}-other`, data);
  add("kms-other-key", "kms:Decrypt", requestKey.replace(/[^/]+$/, "00000000-0000-0000-0000-000000000000"), kms);
  for (const [prefix, action, resource, c] of [["data", "dynamodb:GetItem", table, data], ["kms", "kms:Decrypt", requestKey, kms]]) {
    for (const [suffix, patch] of [
      ["other-principal", { "aws:PrincipalArn": ["string", [principal + "-other"]] }],
      ["missing-principal", { "aws:PrincipalArn": null }],
      ["other-region", { "aws:RequestedRegion": ["string", ["us-east-1"]] }],
      ["missing-region", { "aws:RequestedRegion": null }],
      ["expired", { "aws:CurrentTime": ["date", [deadline]] }],
      ["missing-time", { "aws:CurrentTime": null }]
    ]) add(`${prefix}-${suffix}`, action, resource, c, "explicitDeny", patch);
  }
  for (const [suffix, patch] of [
    ["missing-mfa", { "aws:MultiFactorAuthPresent": null }],
    ["false-mfa", { "aws:MultiFactorAuthPresent": ["boolean", ["false"]] }],
    ["missing-mfa-age", { "aws:MultiFactorAuthAge": null }],
    ["stale-mfa", { "aws:MultiFactorAuthAge": ["numeric", ["901"]] }],
    ["negative-mfa-age", { "aws:MultiFactorAuthAge": ["numeric", ["-1"]] }],
    ["missing-projection", { "dynamodb:Attributes": null }],
    ["proof", { "dynamodb:Attributes": ["stringList", ["id", "proof"]] }],
    ["all-attributes", { "dynamodb:Select": ["string", ["ALL_ATTRIBUTES"]] }],
    ["missing-leading-key", { "dynamodb:LeadingKeys": null }],
    ["wrong-key-shape", { "dynamodb:LeadingKeys": ["stringList", ["too-short"]] }]
  ]) add(`data-${suffix}`, "dynamodb:GetItem", table, data, "explicitDeny", patch);
  for (const k of Object.keys(kmsConstraints)) {
    add(`kms-missing:${k}`, "kms:Decrypt", requestKey, kms, "explicitDeny", { [k]: null });
    add(`kms-wrong:${k}`, "kms:Decrypt", requestKey, kms, "explicitDeny", { [k]: ["string", ["wrong"]] });
  }
  const serviceResources = {
    dynamodb: table, kms: requestKey, iam: principal,
    lambda: "arn:aws:lambda:us-west-2:114599789754:function:simulation-only",
    secretsmanager: "arn:aws:secretsmanager:us-west-2:114599789754:secret:simulation-only-AbCdEf",
    sts: "arn:aws:iam::114599789754:role/simulation-only"
  };
  for (const action of ["dynamodb:Scan", "dynamodb:Query", "dynamodb:ReadDataForReplication", "dynamodb:PutItem", "dynamodb:UpdateItem", "dynamodb:TransactWriteItems", "lambda:InvokeFunction", "iam:PutUserPolicy", "secretsmanager:GetSecretValue", "sts:AssumeRole", "kms:CreateGrant", "kms:Encrypt", "kms:GenerateDataKey"]) {
    add(`forbidden:${action}`, action, serviceResources[action.split(":")[0]], { ...data, ...kms });
  }
  add("shell-allow-create", "cloudshell:CreateEnvironment", "*", common, "allowed");
  const env = "arn:aws:cloudshell:us-west-2:114599789754:environment/test-fixture";
  add("shell-allow-session", "cloudshell:CreateSession", env, common, "allowed");
  add("shell-allow-upload", "cloudshell:GetFileUploadUrls", env, common, "allowed");
  add("shell-deny-download", "cloudshell:GetFileDownloadUrls", env, common);
  add("shell-expired", "cloudshell:CreateSession", env, common, "explicitDeny", { "aws:CurrentTime": ["date", [deadline]] });
  add("shell-other-region", "cloudshell:CreateSession", env, common, "explicitDeny", { "aws:RequestedRegion": ["string", ["us-east-1"]] });
  for (const key of ["VpcIds", "SubnetIds", "SecurityGroupIds"]) {
    add(`shell-vpc:${key}`, "cloudshell:CreateEnvironment", "*", common, "explicitDeny", { [`cloudshell:${key}`]: ["stringList", ["test-fixture"]] });
  }
  assert.equal(new Set(rows.map(r => r.name)).size, rows.length);
  return rows;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  assert.equal(process.argv.length, 3);
  console.info(JSON.stringify(verifierSimulationCases(process.argv[2]), null, 2));
}
