# Release preflight — September 5, 2026 (Pacific)

## Live state, read-only checks

AWS reads succeeded through the account connector in account 114599789754, us-west-2. Connector identity is root; it was not used as a shop operator. DescribeStacks returned customer staging UPDATE_COMPLETE, customer artifacts CREATE_COMPLETE and narrator UPDATE_COMPLETE. ListFunctions returned only the existing narrator and customer HTTP functions. Enrollment request/approval/redemption services are not deployed. No credentials, function environment values or customer records were retrieved.

`node scripts/smoke-customer-lwa-hosted.mjs https://i4ceh4qpdg.execute-api.us-west-2.amazonaws.com` passed all 16 bounded checks. Hosted page/asset hashes matched the reviewed deployed release. No-cookie/invalid-cookie access, forged service/customer/role headers and closed MCP routes rejected access. No real provider sign-in or trusted customer mapping was performed by this run.

Devpost's authenticated read returned project 1416486, name Untitled, no description/video, state submission_pre_draft and no submitted_at timestamp. The live requirements for event 30992 permit a simulated Alexa+ web experience; public source, a public English video under three minutes and tool feedback are required. The original video is not reconciled with the current build. No Devpost writes or video publication occurred.

## Fresh retention-template validation

The owner approved installing cfn-lint and Guard in an isolated local Docker validation image. The exact nonempty JSON template was mounted read-only; validation ran with networking disabled and no credentials. Image `flo-enrollment-validator:local` manifest-list digest: `sha256:96708ef9c58f9210b7aaa9e0fddccd8371cbdcdfbd5cea202bfdc58d49fd6d90`. The image remains local; its disposable validation container exited and was removed automatically. An initial Docker build failed on a transient context-file lock, before validation; the retry used the verified desktop Linux engine endpoint.

Current template SHA-256: `573fe2694bab405740ab93f71c0b912b3c667229ca7f2bbf6e60e9db9d84f775`, 6028 bytes. cfn-lint 1.52.1 returned zero errors/warnings/info (exit 0). Guard 3.2.1 returned FAIL (exit 19): two failing rules, eight leaf findings; two rules passed. The selected eight pinned DynamoDB rule files include four with no executable rule declarations, not four additional passes. Rules source commit: `7f7340c26ae5d5e8874651dbffeb12e0e9f505b6`. Full commands, rule hashes and raw outputs: [validation JSON](enrollment-retention-validation-2026-09-05.json).

| Finding | Resource/property | Treatment still to review against current hash |
| --- | --- | --- |
| DYNAMODB_TABLE_ENCRYPTED_KMS | All three tables: SSESpecification.KMSMasterKeyId and SSEType absent; SSE blocks begin lines 33, 83, 133 | Existing design uses AWS-managed encryption with SSEEnabled true. No customer-managed key was added; do not confuse the stricter explicit-key rule with an unencrypted table. |
| DYNAMODB_PITR_ENABLED | EnrollmentRequests and EnrollmentApprovals: PointInTimeRecoverySpecification.PointInTimeRecoveryEnabled false, lines 42 and 92 | Preserve scoped transient-authority recovery treatment; do not enable backups that could revive consumed/expired authority merely to satisfy a generic rule. Audit PITR remains seven days. |

These are the same resource/property failures as the archived run. Generic rule fixes would set `SSESpecification.SSEType: KMS` plus a reviewed nondefault `KMSMasterKeyId`, and set `PointInTimeRecoveryEnabled: true`. Those changes alter key/cost/recovery decisions and have not been applied. The earlier [validation report](enrollment-state-cloudshell-validation-2026-09-05.md) explains the exact remediation properties and original scoped treatment. This fresh run neither expands that treatment nor labels the raw Guard result as passed. The current exception checker still rejects the new hash pending the explicit review record.

No change set, resource deployment, IAM attachment, key issuance, audit deletion or customer designation was executed. Runtime roles/template, actual MFA operator access and independently verified fictional-A assignment remain separate deployment gates.

## Source publication checks

The publication candidate was scanned without printing secret values. High-confidence Amazon client-secret, AWS access-key, GitHub/Slack/OpenAI-token and private-key patterns produced no matches. Generic credential assignments occur in test/smoke fixtures and remain review items for final submission; this is not a comprehensive vulnerability scan. Only `.env.example` appeared among credential-looking publication candidates, with blank real-provider credential fields. `.private`, real `.env` files and customer-link files remain ignored; Python bytecode/cache ignores were added without deleting files.

The GitHub CLI session is authenticated for agammann. A Git credential-helper ordering problem blocked the first dry-run; a command-scoped helper override succeeded, without changing saved auth configuration or exposing tokens. No force push is needed. Final CI/source results must be verified on the resulting commit, not inferred from these preflight notes.

GitHub push protection subsequently rejected the first publication attempt. Its client-secret locations were inspected by field/type classification without printing values: each was an `ArtifactKey` deployment ZIP path containing a SHA-256 hash, not a plaintext client secret. The paired LWA client-ID locations were deployment-specific public identifiers. Those identifiers were removed from six public evidence files; artifact provenance hashes were preserved. No scanner bypass was used. The unpublished local commit was amended before retrying, so the flagged identifiers were not retained in the proposed publication history. This also demonstrates why the local pattern scan alone is not sufficient release assurance.

## Release gates

1. Review current-hash policy treatment and exact new runtime/storage resources/costs before AWS execution.
2. Deploy the separately scoped enrollment infrastructure only after that review; do not widen existing customer-read permissions.
3. Establish the independent fictional-customer mapping and verify real operator MFA/denial paths and hosted customer A/B isolation.
4. Verify public source and fresh CI; update release text only with actual results.
5. Record a new video from the final verified build; review audio, captions, thumbnail and accurate pricing. Keep the existing video intact and do not claim a replacement exists yet.
6. Complete applicable Alexa+ checks without conflating website login with account linking. Obtain user-only eligibility declarations and show the final Devpost submission for explicit confirmation. Video publication also retains its separate confirmation gate.
