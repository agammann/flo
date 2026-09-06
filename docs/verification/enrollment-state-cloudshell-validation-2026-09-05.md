# Enrollment storage — completed CloudShell validation

**Historical result:** subsequent approved 30-day audit retention changed the template. This report/raw JSON now apply only to [the archived pre-retention template](enrollment-state-pre-retention.template.json). Use `--historical` to verify that evidence; the default exception checker rejects the current revision. See [retention verification](enrollment-audit-retention-2026-09-05.md). The results below are not validation of the new hash.

## Result

The unchanged template has **0 cfn-lint errors, 0 warnings, 0 informational findings**. Guard reports **2 failing policies**, 2 passing policies, and no not-applicable rule results. Guard exited 19; this is not a clean policy pass or deployment approval.

Template: `infra/aws/customer-enrollment/state.template.json`, 5,845 bytes, SHA-256 `58881cef3da86e8dcff4119e3475a5ca9c2ee7078cba2879289118f5b0bd9cbd`. The transferred bytes matched the local file before either validator ran. No template properties or rule suppressions were changed.

## Environment and reproducibility

The user restored an active Oregon CloudShell session. Its console banner identifies root in account `114599789754`; it was used only to run local validation tools and handle the approved nonsecret template. No AWS CLI/SDK mutation, customer approval or credential retrieval was performed.

- cfn-lint: existing `1.52.1`; `cfn-lint --format json --regions us-west-2 --template state.template.json`; stdout `[]`, stderr empty, exit 0.
- Guard: official release `3.2.1`, restored into `/tmp/flo-enrollment-validate-aqKoi5` because the earlier temporary installation was absent. Download SHA-256 `8c66efb19c63e6c2bf26b9a41bbcf2f85baa8a937b01d350940194faaf64cf1d` matched the official release API digest before extraction/execution.
- Rules: AWS Guard Rules Registry commit `7f7340c26ae5d5e8874651dbffeb12e0e9f505b6`; checkout hash verified, working tree clean.
- Selection: all 8 readable top-level `rules/aws/dynamodb/*.guard` files. Four contain executable rules. The autoscaling, in-backup-plan, resources-protected-by-backup-plan and throughput-limit files contain no executable `rule` declarations in this pinned version. Do not count those four files as passed checks.
- Command: `cfn-guard validate --rules <the eight selected files> --data state.template.json --output-format json --structured --show-summary none --type CFNTemplate`.

Complete structured Guard findings, lint findings/stderr, exit code, exact resolved Guard command and individual rule-file hashes are saved in [raw evidence](enrollment-state-cloudshell-validation-2026-09-05.json). The compact exported evidence bytes were checksum-verified during transfer before pretty-printing to the repository. Raw files also remain in the temporary CloudShell directory; that directory is not relied upon as durable evidence.

## Findings and treatment for review

| Policy | Affected resources | Meaning |
| --- | --- | --- |
| `DYNAMODB_PITR_ENABLED` — FAIL | EnrollmentRequests, EnrollmentApprovals | Their `PointInTimeRecoveryEnabled` values are explicitly false. Audit already has PITR enabled. |
| `DYNAMODB_TABLE_ENCRYPTED_KMS` — FAIL | All three tables | The rule requires both explicit `KMSMasterKeyId` and `SSEType: KMS`; both properties are omitted. |
| `DYNAMODB_BILLING_MODE_RULE` — PASS | Table selection | The on-demand billing configuration satisfies this rule. |
| `DYNAMODB_TABLE_MUST_BE_ENCRYPTED` — PASS | All three tables | `SSESpecification.SSEEnabled` is true. |

Guard produced 8 failing leaf checks: 2 PITR values and 6 missing KMS properties. These are grouped into the 2 policy failures above, not 8 independent architectural issues. In the JSON template, PITR false values are at lines 42 and 92; the SSE specification blocks start at lines 33, 83 and 133. Guard's raw location labels use a different line base; paths in the raw artifact identify the exact properties.

### PITR: validation finding, subsequently covered by scoped approval below

The generic policy remediation is:

```yaml
PointInTimeRecoverySpecification:
  PointInTimeRecoveryEnabled: true # Generic rule fix; do not apply to transient authority without recovery review.
```

For this design, prefer a reviewed exception for only EnrollmentRequests and EnrollmentApprovals, retaining explicit server-side expiry/consumption checks and prohibiting restoration/reconnection of old authority state. Do not enable backups just to turn the rule green. Audit remains separately backed up and is never a source for reconstructing customer links. No backup or exception configuration was changed under this validation-only approval.

### Encryption: this is not an unencrypted-table finding

AWS documents that `SSEEnabled: true` selects KMS with the AWS-managed DynamoDB key when no other key is specified. It also says to provide `KMSMasterKeyId` only for a key different from the default `alias/aws/dynamodb`. See [CloudFormation SSESpecification](https://docs.aws.amazon.com/AWSCloudFormation/latest/TemplateReference/aws-properties-dynamodb-table-ssespecification.html).

The generic explicit-key remediation is:

```yaml
SSESpecification:
  SSEEnabled: true
  SSEType: KMS
  KMSMasterKeyId: <reviewed-nondefault-key-ARN> # Requires a separate key-management/cost decision.
```

Do not insert a fabricated key ARN, add customer-managed keys, or redundantly force the default alias merely to satisfy the static rule. Proposed treatment is a scoped exception retaining the valid AWS-managed-key configuration. Adding `SSEType: KMS` alone would not clear the rule's separate key-ID requirement. AWS KMS usage charges can still apply with the current AWS-managed-key setting; no additional customer-managed key does not mean no encryption-related usage cost.

## Subsequent policy-treatment approval

After reviewing these findings, the user explicitly approved **documenting** AWS-managed encryption for all three tables and no PITR for requests/approvals only, **without deployment**. This is recorded separately in [the exception manifest](../../infra/aws/customer-enrollment/policy-exceptions.json), pinned to the unchanged template SHA-256 above and the raw evidence's compact-JSON SHA-256 `1b013f88b8d472b3167dcc587320e9157d6dcc6cba16a20eb9b3d9f300d8ec7b`.

This approval does not alter the historical validation output: **Guard remains FAIL**, with two failing rules and eight failing leaf checks. No findings are suppressed or rewritten. The preceding proposals describe the validation-time findings; the subsequent approval accepts only the manifest's listed policy treatment. The template itself remains unchanged, including audit PITR enabled with a seven-day recovery window. No new keys, backups, tables, permissions, customer mappings or hosted routes were created.

`node scripts/check-enrollment-policy-exceptions.mjs` checks exact template bytes, pinned raw evidence and rule/resource/property coverage. Its regression tests reject scope expansion, changed evidence, changed templates and deployment-approval claims. These are local consistency checks, not a new Guard execution, a trusted authorization system, proof of live controls or blanket certification. Review the exceptions again before deployment or any change to template, evidence, scope, authorization or recovery assumptions.

Local follow-up verification: the storage-plan invariant check and exception-record check passed; all 13 exception-record tests passed. Repository-wide `pnpm lint` and `git diff --check` also passed. CI now includes both the exception check and its tests, but no new GitHub Actions run is claimed. A narrowly scoped `.gitattributes` entry preserves LF for the hash-pinned template across Windows/Linux checkouts without changing the template bytes.

## Remaining gates

1. Preserve the approved scoped exceptions and raw findings. Any changed key/recovery design or expanded scope requires revalidation and renewed review; there is no unconditional Guard pass or deployment approval.
2. Resolve the operator's independently enforced fictional-customer A designation and programmatic MFA. The local editable grant file and console MFA are not sufficient by themselves.
3. Finish and validate exact runtime permissions, resource/cost plan and CloudFormation change-set checks before requesting execution. This turn created no change set and performed no pre-deployment `describe-events` validation.
4. Define audit-record retention separately: a seven-day PITR window is not seven-day record retention.

Only validation tooling, temporary nonsecret files and local evidence documentation changed. Existing application stacks, IAM permissions, customer links, secrets and hosted routes were not modified. No application build, Docker regression run, GitHub push or Actions run is newly claimed for this documentation-only increment. Submission and video publication remain paused.
