"""Read-only IAM condition checks, not a live KMS/log-delivery test.

Requires the approved CloudShell cfn-lint and AWS CLI installations.
Example: python3 scripts/check-narrator-kms-policy.py --template
infra/aws/bedrock-narrator/template.yaml --account 114599789754 --region us-west-2

The simulator cannot reproduce a service's complete key-policy authorization.
This script verifies the exact role principal, projects ONLY the two caller
statements onto a synthetic key ARN, and checks their conditions with AWS IAM.
It does not attach policies, create keys, invoke Bedrock, or read secret values.
"""

import argparse
import copy
import json
import subprocess

from cfnlint.decode import decode


def aws_json(*args):
    result = subprocess.run(
        ["aws", *args, "--output", "json", "--no-cli-pager"],
        check=True, capture_output=True, text=True,
    )
    return json.loads(result.stdout)


parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--template", required=True)
parser.add_argument("--account", required=True)
parser.add_argument("--region", required=True)
args = parser.parse_args()
assert aws_json("sts", "get-caller-identity")["Account"] == args.account
template, errors = decode(args.template)
assert not errors, errors
statements = template["Resources"]["NarratorLogsKey"]["Properties"]["KeyPolicy"]["Statement"]
selected = {s["Sid"]: s for s in statements if s.get("Sid") in {
    "NarratorLogCryptoViaCloudWatch", "NarratorLogKeyMetadataViaCloudWatch",
}}
assert len(selected) == 2
crypto = selected["NarratorLogCryptoViaCloudWatch"]
metadata = selected["NarratorLogKeyMetadataViaCloudWatch"]
crypto_actions = ["kms:Encrypt", "kms:Decrypt", "kms:ReEncryptFrom", "kms:ReEncryptTo",
                  "kms:GenerateDataKey", "kms:GenerateDataKeyWithoutPlaintext"]
assert crypto["Action"] == crypto_actions
assert metadata["Action"] == "kms:DescribeKey"
assert "ArnEquals" not in metadata["Condition"]
for statement in selected.values():
    assert statement["Principal"] == {"AWS": {"Fn::GetAtt": ["NarratorRole", "Arn"]}}
    assert statement["Effect"] == "Allow" and statement["Resource"] == "*"

substitutions = {"AWS::Partition": "aws", "AWS::Region": args.region, "AWS::AccountId": args.account}


def resolve(value):
    if isinstance(value, list):
        return [resolve(item) for item in value]
    if isinstance(value, dict):
        if set(value) == {"Ref"}:
            return substitutions[value["Ref"]]
        if set(value) == {"Fn::Sub"}:
            result = value["Fn::Sub"]
            for name, replacement in substitutions.items():
                result = result.replace("${" + name + "}", replacement)
            assert "${" not in result
            return result
        return {name: resolve(item) for name, item in value.items()}
    return value


# The ARN is intentionally synthetic; IAM simulation does not access a KMS key.
key_arn = f"arn:aws:kms:{args.region}:{args.account}:key/00000000-0000-0000-0000-000000000001"
projected = []
for statement in selected.values():
    item = copy.deepcopy(statement)
    del item["Principal"]
    item["Resource"] = key_arn
    projected.append(resolve(item))
policy = json.dumps({"Version": "2012-10-17", "Statement": projected})
group = f"arn:aws:logs:{args.region}:{args.account}:log-group:/aws/lambda/flo-bedrock-narrator"
base = {"kms:ViaService": f"logs.{args.region}.amazonaws.com", "kms:CallerAccount": args.account}
context_key = "kms:EncryptionContext:aws:logs:arn"
valid = {**base, context_key: group}
cases = [
    ("valid-crypto", valid, crypto_actions, "allowed"),
    ("metadata-without-encryption-context", base, ["kms:DescribeKey"], "allowed"),
    ("wrong-log-group", {**valid, context_key: group + "-other"}, crypto_actions, "implicitDeny"),
    ("api-access-log-is-not-caller-scope", {**valid, context_key: f"arn:aws:logs:{args.region}:{args.account}:log-group:/aws/apigateway/flo-bedrock-narrator-access"}, crypto_actions, "implicitDeny"),
    ("missing-crypto-context", base, crypto_actions, "implicitDeny"),
    ("direct-kms", {k: v for k, v in valid.items() if k != "kms:ViaService"}, crypto_actions + ["kms:DescribeKey"], "implicitDeny"),
    ("wrong-service", {**valid, "kms:ViaService": f"dynamodb.{args.region}.amazonaws.com"}, crypto_actions + ["kms:DescribeKey"], "implicitDeny"),
    ("wrong-account", {**valid, "kms:CallerAccount": "000000000000"}, crypto_actions + ["kms:DescribeKey"], "implicitDeny"),
    ("missing-account", {k: v for k, v in valid.items() if k != "kms:CallerAccount"}, crypto_actions + ["kms:DescribeKey"], "implicitDeny"),
    ("no-key-administration", valid, ["kms:PutKeyPolicy", "kms:CreateGrant", "kms:ScheduleKeyDeletion"], "implicitDeny"),
]
checked = 0
for label, context, actions, expected in cases:
    entries = [{"ContextKeyName": k, "ContextKeyValues": [v], "ContextKeyType": "string"} for k, v in context.items()]
    response = aws_json("iam", "simulate-custom-policy", "--policy-input-list", policy,
                        "--action-names", *actions, "--resource-arns", key_arn,
                        "--context-entries", json.dumps(entries), "--region", args.region)
    results = response["EvaluationResults"]
    assert len(results) == len(actions), label
    assert all(r["EvalDecision"] == expected for r in results), (label, results)
    checked += len(results)
    print(f"PASS {label}: {len(results)} action decisions = {expected}", flush=True)
print(json.dumps({"scenarios": len(cases), "actionDecisions": checked, "result": "PASS",
                  "scope": "IAM caller-statement projection; NOT live key or log-delivery verification"}))
