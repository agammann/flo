# Enrollment runtime deployment: created, startup verification blocked

2026-09-06. Runtime source: `86139591cdc6f0c10b89055dba078788101e14f7`.

## Approved operation and result

The owner separately approved execution of change set
`flo-enrollment-runtime-review-20260906T143900Z` and at most 12 synthetic,
synchronous disabled-state checks. The change set was rechecked in account
`114599789754`, us-west-2: 18 Add actions, no replacements/removals, all
processing/public-route parameters false, and no `DescribeEvents` validation
errors. `ExecuteChangeSet` was called once with an idempotent request token.

`flo-customer-enrollment` reached `CREATE_COMPLETE`. The three version-1 Lambda
functions match the reviewed ZIP sizes and SHA-256 values. Each has 256 MB memory
and reserved concurrency one; request timeout is 20 seconds and the two private
timeouts are 10 seconds. Their three execution roles retain their reviewed
permissions boundaries and attached baseline policies; no inline policies exist.

The request and redemption gates remain false, the approval gate remains false,
and approval designation is null. The request references redemption version 1.
No secret values were returned in verification output. The existing API still
has only its original `$default` route targeting `integrations/qfwnq4s`.

## Live failure: do not claim a working runtime

The first synthetic invocation targeted approval version 1 with `{}`. Lambda
returned `KMSAccessDeniedException` before executing the handler: its execution
role is explicitly denied `kms:Decrypt` by the approval permissions boundary.
The key metadata identifies enabled AWS-managed `alias/aws/lambda`, key
`57e62ad6-a638-40c9-9af6-df42a6418968`.

One Invoke tool call was made. The connector reports three automatic retries;
the script stopped at that exception, with no further function invocations.
There were zero successful handler checks. No enrollment records or customer
links were created by this failed invocation. The other two boundaries have the
same `DenyEveryOtherCapability` exclusion of KMS; their analogous startup failure
is an inference, not an independently executed test.

AWS documents default Lambda environment encryption and normally managed key
permissions. This deployment's explicit-deny boundary is materially different
from simply omitting a KMS Allow. The live error is the decisive evidence.
See [AWS environment encryption documentation](https://docs.aws.amazon.com/lambda/latest/dg/configuration-envvars-encryption.html).

No IAM permissions were widened to bypass the failure. A narrowly scoped
environment-decryption correction requires policy tests and a new reviewed
CloudFormation change set. It must not grant unrelated KMS, Secrets Manager,
repair-data or operator access, and all three enable flags must remain false.

## Logs and preserved workloads

All three new log groups have seven-day retention and WARN-level JSON logging.
The final read returned no log streams. **Log delivery is not verified.** The
earlier log-stream policy simulator discrepancy is also unresolved; a failed
pre-handler startup does not validate application logging.

Final reads: customer staging and narrator remain `UPDATE_COMPLETE`, with their
last-update timestamps unchanged from before this deployment. No live changes
were made to those stacks. No public pairing routes, operator permissions,
customer mappings, Devpost submission or video publication were enabled.

## Fresh local checks

- `pnpm test`: build passed; 151 tests, 148 passed, zero failed, three Windows skips.
- `pnpm typecheck`: passed across all 13 workspace configurations.
- `pnpm lint`: passed with zero allowed warnings.

These checks do not substitute for the blocked live-runtime checks. The earlier
green GitHub Actions/Docker result remains historical evidence for the same
runtime source; a new CI run was not initiated as part of this deployment check.

See [machine-readable deployment evidence](enrollment-runtime-deployment-2026-09-06.json).
The earlier change-set document is a pre-execution snapshot, superseded by this
record for current deployment status.
