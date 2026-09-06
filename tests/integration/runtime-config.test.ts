import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, it } from "node:test";
import { isDemoModeEnabled } from "@flo/mcp";

describe("Flo runtime configuration", () => {
  it("requires an explicit opt-in to expose demo tools in a production runtime", () => {
    assert.equal(isDemoModeEnabled({ NODE_ENV: "production" }), false);
    assert.equal(isDemoModeEnabled({ NODE_ENV: "production", FLO_DEMO_MODE: "false" }), false);
    assert.equal(isDemoModeEnabled({ NODE_ENV: "production", FLO_DEMO_MODE: "true" }), true);
    assert.equal(isDemoModeEnabled({ NODE_ENV: "development" }), true);
  });

  it("keeps the image in production mode while opting the local Docker demo into demo controls", async () => {
    const [dockerfile, compose] = await Promise.all([
      readFile(resolve("Dockerfile"), "utf8"),
      readFile(resolve("docker-compose.yml"), "utf8")
    ]);
    assert.match(dockerfile, /ENV NODE_ENV=production/);
    const blocks = compose.split(/\n(?= {2}[a-z]+:\r?\n)/);
    for (const service of ["mcp", "simulator"]) {
      const block = blocks.find(value => value.startsWith(`  ${service}:`));
      assert.ok(block, `${service} service exists`);
      assert.match(block, /FLO_DEMO_MODE:\s*"true"/);
    }
  });

  it("documents the hostname-based origin key consumed by the MCP service", async () => {
    const example = await readFile(resolve(".env.example"), "utf8");
    assert.match(example, /^ALLOWED_ORIGIN_HOSTNAMES=/m);
    assert.doesNotMatch(example, /^ALLOWED_ORIGINS=/m);
  });
  it("keeps finite narrator log retention in source and documents the existing-group import gate", async () => {
    const template = await readFile(resolve("infra/aws/bedrock-narrator/template.yaml"), "utf8");
    const block = template.split("  NarratorLogGroup:")[1]?.split("  NarratorFunction:")[0];
    assert.ok(block);
    assert.match(block, /Type: AWS::Logs::LogGroup/);
    assert.match(block, /RetentionInDays: 7/);
    assert.match(block, /DeletionPolicy: Retain/);
    assert.match(block, /LogGroupName: \/aws\/lambda\/flo-bedrock-narrator/);
    const guide = await readFile(resolve("infra/aws/bedrock-narrator/README.md"), "utf8");
    assert.match(guide, /IMPORT/);
    assert.match(guide, /Never delete the group/);
  });

  it("encrypts finite operational logs without recording customer data or credentials", async () => {
    const template = await readFile(resolve("infra/aws/bedrock-narrator/template.yaml"), "utf8");
    for (const name of ["NarratorLogGroup", "NarratorAccessLogGroup"]) {
      const block = template.split(`  ${name}:\n`)[1]!.split(/\n {2}[A-Za-z]+:\n/)[0]!;
      assert.match(block, /RetentionInDays: 7/);
      assert.match(block, /KmsKeyId: !GetAtt NarratorLogsKey.Arn/);
      assert.match(block, /DeletionPolicy: Retain/);
    }
    const format = template.match(/^ {8}Format: '(.*)'$/m)?.[1];
    assert.ok(format);
    assert.deepEqual(Object.keys(JSON.parse(format) as Record<string, unknown>).sort(), ["latency", "requestId", "status"]);
    assert.doesNotMatch(format, /identity|header|authoriz|body|query|ip|path/i);
    assert.match(template, /kms:EncryptionContext:aws:logs:arn:/);
  });

  it("scopes narrator log-key caller access and separates metadata from crypto context", async () => {
    const template = await readFile(resolve("infra/aws/bedrock-narrator/template.yaml"), "utf8");
    const key = template.split("  NarratorLogsKey:\n")[1]!.split("  NarrationAllowanceKey:")[0]!.replace(/^\s*#.*$/gm, "");
    const crypto = key.split("- Sid: NarratorLogCryptoViaCloudWatch\n")[1]?.split("- Sid:")[0];
    const metadata = key.split("- Sid: NarratorLogKeyMetadataViaCloudWatch\n")[1]?.split("- Sid:")[0];
    assert.ok(crypto, "Caller crypto permission is explicit in the containing key policy");
    assert.ok(metadata, "DescribeKey must not require a nonexistent encryption context");
    for (const statement of [crypto, metadata]) {
      assert.match(statement, /AWS: !GetAtt NarratorRole.Arn/);
      assert.match(statement, /Effect: Allow/);
      assert.match(statement, /Resource: "\*"/);
      assert.match(statement, /kms:ViaService: !Sub logs\.\$\{AWS::Region\}\.amazonaws\.com/);
      assert.match(statement, /kms:CallerAccount: !Ref AWS::AccountId/);
      assert.doesNotMatch(statement, /IfExists|ForAllValues|kms:(CreateGrant|PutKeyPolicy|ScheduleKeyDeletion)|Action:.*kms:\*/);
    }
    assert.match(crypto, /Action: \[kms:Encrypt, kms:Decrypt, kms:ReEncryptFrom, kms:ReEncryptTo, kms:GenerateDataKey, kms:GenerateDataKeyWithoutPlaintext\]/);
    assert.match(crypto, /kms:EncryptionContext:aws:logs:arn: !Sub arn:\$\{AWS::Partition\}:logs:\$\{AWS::Region\}:\$\{AWS::AccountId\}:log-group:\/aws\/lambda\/flo-bedrock-narrator/);
    assert.doesNotMatch(crypto, /apigateway|kms:DescribeKey/);
    assert.match(metadata, /Action: kms:DescribeKey/);
    assert.doesNotMatch(metadata, /EncryptionContext/);
    const service = key.split("- Sid: EncryptOnlyFloLogs\n")[1]!.split("- Sid:")[0]!;
    assert.match(service, /Service: !Sub logs\.\$\{AWS::Region\}\.amazonaws\.com/);
    assert.match(service, /log-group:\/aws\/lambda\/flo-bedrock-narrator/);
    assert.match(service, /log-group:\/aws\/apigateway\/\$\{AWS::StackName\}-access/);
    assert.doesNotMatch(key, /!GetAtt Narrator(?:Access)?LogGroup/);
    const role = template.split("  NarratorRole:\n")[1]!.split("  NarratorRuntimePolicy:")[0]!;
    assert.doesNotMatch(role, /NarratorLogsKey|^ {6}Policies:/m);
  });

  it("keeps a positive bounded concurrency reservation and preserves narrow runtime actions", async () => {
    const template = await readFile(resolve("infra/aws/bedrock-narrator/template.yaml"), "utf8");
    assert.match(template, /^ {6}ReservedConcurrentExecutions: 2(?: #.*)?$/m);
    assert.doesNotMatch(template, /NarratorReservedConcurrency/);
    const role = template.split("  NarratorRole:\n")[1]!.split("  NarratorRuntimePolicy:")[0]!;
    assert.doesNotMatch(role, /^ {6}Policies:/m);
    const policy = template.split("  NarratorRuntimePolicy:\n")[1]!.split("  NarratorLogGroup:")[0]!;
    assert.match(policy, /Type: AWS::IAM::ManagedPolicy/);
    assert.match(policy, /Roles: \[!Ref NarratorRole\]/);
    assert.match(policy, /dynamodb:LeadingKeys: \[flo-lifetime-v1\]/);
    assert.match(policy, /"Null":\n\s+dynamodb:LeadingKeys: "false"/);
    assert.doesNotMatch(policy, /dynamodb:(PutItem|Restore|Delete|Create|\*)/);
    assert.match(template, /DependsOn: \[NarratorRuntimePolicy, NarratorLogGroup\]/);
  });

  it("backs up the allowance without granting runtime restore or general KMS access", async () => {
    const template = await readFile(resolve("infra/aws/bedrock-narrator/template.yaml"), "utf8");
    const table = template.split("  NarrationAllowance:\n")[1]!.split("  NarratorRole:")[0]!;
    assert.match(table, /KMSMasterKeyId: !GetAtt NarrationAllowanceKey.Arn/);
    assert.match(table, /SSEType: KMS/);
    assert.match(table, /PointInTimeRecoveryEnabled: true/);
    assert.match(table, /RecoveryPeriodInDays: 7/);
    assert.match(table, /DeletionProtectionEnabled: true/);
    const key = template.split("  NarrationAllowanceKey:\n")[1]!.split("  NarrationAllowance:")[0]!;
    assert.match(key, /EnableKeyRotation: true/);
    assert.match(key, /DeletionPolicy: Retain/);
    assert.match(key, /kms:ViaService: !Sub dynamodb.\$\{AWS::Region\}.amazonaws.com/);
    assert.match(key, /kms:EncryptionContext:aws:dynamodb:tableName: flo-narration-allowance/);
    const recovery = await readFile(resolve("infra/aws/bedrock-narrator/recovery.md"), "utf8");
    assert.match(recovery, /remaining=0/);
    assert.match(recovery, /Never reconnect a restored snapshot/);
  });

  it("limits accepted policy exceptions to the approved synchronous narrator design", async () => {
    const exception = JSON.parse(await readFile(resolve("infra/aws/bedrock-narrator/policy-exceptions.json"), "utf8")) as {
      approvedOn: string; reviewBy: string; resource: string; exceptions: { rule: string; reason: string }[];
    };
    assert.equal(exception.resource, "NarratorFunction");
    assert.deepEqual(exception.exceptions.map(value => value.rule).sort(), ["LAMBDA_DLQ_CHECK", "LAMBDA_INSIDE_VPC"]);
    assert.ok(Date.parse(exception.reviewBy) > Date.now(), "Policy exceptions need owner re-review after their review date");
    const template = await readFile(resolve("infra/aws/bedrock-narrator/template.yaml"), "utf8");
    assert.match(template, /AuthorizationType: AWS_IAM/);
    assert.match(template, /RouteKey: POST \/narrate/);
    assert.doesNotMatch(template, /AWS::Lambda::(Url|EventSourceMapping|EventInvokeConfig)|AWS::Events::Rule|AWS::SNS::Subscription/);
    assert.doesNotMatch(template, /guard:\s*\n\s*SuppressedRules/);
  });
});
