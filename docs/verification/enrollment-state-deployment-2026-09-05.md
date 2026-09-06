# Enrollment storage deployed and verified

The owner approved executing the exact three-table change set after reviewing its additions, policy treatment and usage-based costs. Stack `flo-customer-enrollment-state` in account 114599789754, us-west-2 reached **CREATE_COMPLETE**. Operation `f30ca6f7-02eb-4367-80ca-f7046468e192` succeeded at 2026-09-06T06:32:05.440Z (September 5 Pacific).

Change set: `flo-enrollment-state-review-20260906T062545Z`. Client request token: `flo-enrollment-state-owner-approved-20260906T062545Z`. Exact template SHA-256: `573fe2694bab405740ab93f71c0b912b3c667229ca7f2bbf6e60e9db9d84f775`. The final pre-execution check reconfirmed the account, available change set and exactly three Add actions. No replacements, removals, IAM capabilities or parameters were included.

## Observed live settings

| Logical resource | Status / mode | TTL | PITR |
| --- | --- | --- | --- |
| EnrollmentRequests | ACTIVE / Standard on-demand | ENABLED on ttl | DISABLED |
| EnrollmentApprovals | ACTIVE / Standard on-demand | ENABLED on ttl | DISABLED |
| EnrollmentAudit | ACTIVE / Standard on-demand | ENABLED on ttl | ENABLED, 7 days |

All three actual tables have deletion protection enabled, a string id partition key and maximum throughput of 10 read / 5 write request units. All report SSE ENABLED with KMS. DescribeKey confirms KeyManager AWS and KeyState Enabled; no customer-managed key was created. The deployed CloudFormation template preserves Retain on deletion and replacement for every table. Raw allowlisted metadata and successful API-call records are in [deployment evidence](enrollment-state-deployment-2026-09-05.json).

This was metadata verification, not a table scan or application write. No records were seeded, no customer was linked, no operator credentials or permissions were created, and no website routes or existing application stacks were changed. AWS's physical TTL deletion timing and an actual backup restore were not tested. The 30-day audit expiry rule exists in application code; enabling table TTL alone does not prove that an undeployed writer is running.

## Release checks and remaining work

The source publication initially triggered GitHub push protection on public LWA client IDs paired with artifact ZIP paths containing hashes. Inspected ArtifactKey fields were not plaintext client secrets. Deployment-specific IDs were redacted from public evidence, the unpublished commit was amended, and the push succeeded without a scanner bypass or force push.

Published source commit `cbf94e54ccefe4f12a08934023c320521e983757` passed [CI 34016526840](https://github.com/agammann/flo/actions/runs/34016526840). The subsequent review-documentation commit `2636c53b707b6a714e553755cd9f662317aad67b` also passed [CI 34016696370](https://github.com/agammann/flo/actions/runs/34016696370). Both verify and real Docker demo jobs succeeded. The public GitHub API confirms `private: false` and MIT license detection. The hosted customer site separately passed all 16 pre-login checks during this turn; that test did not exchange real provider credentials or establish repair ownership.

Next: finish the separate enrollment runtime/IAM plan, review its exact resources/costs before execution, establish real programmatic MFA and the independent fictional-A designation, and test hosted pairing/customer B isolation. Do not grant the existing customer-read role write access as a shortcut. Official Alexa+ linking/certification remains separate. The replacement demo is still to be recorded after the final intended flow is verified; audio/captions/thumbnail must be reviewed. Devpost is an empty unsubmitted draft, and video/Devpost publication remain separately confirmed actions.
