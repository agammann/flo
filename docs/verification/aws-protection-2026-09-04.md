# AWS narration protection: live deployment verification

Verified on September 4, 2026 (America/Los_Angeles), following explicit approval to deploy IAM protection and initialize 100 lifetime model attempts.

## Deployed source and target

- Stack: `flo-bedrock-narrator`, region `us-west-2`.
- Source commit: `957b3b8c8bad264b5911f5c386610bee77282f84`.
- Source: `infra/aws/bedrock-narrator/template.yaml`.
- Template SHA-256: `39ebe01d2503ca1f933b9f162d4c38eba5c79034ee96d6f0fa7aee3f9744026c`.
- Local and CloudShell upload checksums matched; CloudFormation `validate-template` passed.
- `aws cloudformation deploy` completed successfully; subsequent `describe-stacks` returned `UPDATE_COMPLETE`.
- The only API route, `POST /narrate`, was read back as `AWS_IAM`.

## Live checks

Checks used the existing CloudShell AWS identity through botocore SigV4 signing. No credentials were copied to the local development host, browser application, repository, or report. Checks were spaced to avoid intentionally stressing the throttle.

| Check | Observed result |
| --- | --- |
| Unsigned request carrying a public build marker | HTTP 403, Forbidden |
| Valid signed request before initialization | HTTP 429, Narration allowance unavailable or exhausted |
| Invalid signed task before initialization | HTTP 400, Invalid narration request |
| Read allowance after rejected checks | Record still absent |
| Conditional initialization using `attribute_not_exists(id)` | Succeeded once: remaining 100, used 0 |
| Valid signed request after initialization | HTTP 200, qualitative lead from `amazon.nova-lite-v1:0` |
| Unsigned request after initialization | HTTP 403 |
| Invalid signed task after initialization | HTTP 400 |
| Strongly consistent allowance read-back | remaining 99, used 1 |
| CloudWatch retention write and read-back | 7 days |
| DynamoDB deletion protection | Enabled |
| API Gateway stage throttle | Rate 1 request/second, burst 2 (best effort) |
| Lambda configuration | Active; last update Successful; timeout 8 seconds; memory 256 MB |
| Lambda allowance permission | UpdateItem scoped to the allowance table and `flo-lifetime-v1` key |

The original unauthenticated model-call path no longer reproduced. Legitimate signed narration remained functional. Rejected calls did not consume the initialized model allowance. The allowance was not reset or refilled after testing.

## Source checks and limitations

- Prior full [CI run 6](https://github.com/agammann/flo/actions/runs/33945488566) passed build, lint, typecheck, all 34 tests, and real Docker Compose smoke execution on the exact deployed source.
- At deployment time, typecheck and lint passed again. `node scripts/run-tests.mjs tests` passed 26 integration/end-to-end tests, including the seven narrator-boundary cases. An initial narrower test-directory selection found no compiled files; selecting the owning `tests` root resolved the invocation, with no source fix required.
- Missing-allowance behavior was verified live. Exhaustion, corrupt/unavailable ledger state, model failures, and concurrent reservation behavior were exercised by automated tests; the live allowance was not deliberately depleted for testing.
- The one successful live test consumed one model attempt. Remaining 99 is a verification-time snapshot, not a promise that the balance never changes.
- There is no automatic refill or refund in the implementation. The limit applies to this narration path, not all possible Bedrock usage or the AWS account bill. API Gateway, Lambda, DynamoDB, logs, storage, and rejected traffic can still incur charges.
- Local simulator AWS credentials were not provisioned by this deployment. An unconfigured simulator uses its deterministic fallback. Successful CloudShell narration is not proof of a newly authenticated local simulator session.
- Alexa+ toolkit access and official add-on/device validation remain pending. AgentCore was not deployed. YouTube visibility and Devpost submission state were not changed.
