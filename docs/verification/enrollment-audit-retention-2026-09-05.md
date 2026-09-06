# Approved fictional-staging audit retention — local implementation

Subsequent release preflight: fresh cfn-lint/Guard validation has now run in isolated local Docker. Schema checks passed; Guard still reports the two existing policy failures. See [current raw evidence](enrollment-retention-validation-2026-09-05.json) and [review scope](release-preflight-2026-09-05.md). The original pending-validation statements below record the implementation checkpoint, not the later run. No deployment approval or live change is implied.

## Scope and outcome

The owner approved a **30-day audit-record retention target**, asynchronous cleanup and expiry filtering, while preserving the audit table's **seven-day PITR recovery window**. This increment implements that decision locally. It does not deploy resources, alter live TTL, delete live records, establish a customer mapping, attach IAM policies, create credentials, push source, submit to Devpost or publish a video.

The scope is fictional staging enrollment evidence, not a general retention policy for real repair records, customer links or authentication state.

## Implementation

- Both durable approval and redemption transactions now write a strictly validated audit record with its original event timestamp, `retentionVersion: 1`, exact millisecond `expiresAt` at 30 days, and integer Unix-second `ttl` rounded up. Audit creation still participates in the existing atomic transaction.
- The local test backend uses the same record builder. Neither writer includes invitation hashes, request codes, session credentials or bearer tokens in audit evidence.
- `visibleEnrollmentAudit` rejects expired records at the exact application deadline, future records, malformed/legacy records, extra fields and inconsistent expiry/TTL. It preserves the original event time and returns validated copies. Reading an old snapshot never assigns a fresh retention window.
- This shared helper is exercised by the local test backend and the DynamoDB Local contract. **There is no deployed production audit-reader, export or restore endpoint in this increment.** Future reader/export/recovery tooling must enforce this boundary before presenting evidence. No live recovery procedure has been executed.
- Legacy records without valid retention metadata fail closed for display/export. Any historical reconciliation requires separate controlled review; do not silently restart their clocks or restore approval/session authority from audit evidence.
- The proposed `EnrollmentAudit` CloudFormation resource enables TTL on `ttl`. Seven-day audit PITR, deletion protection, Retain policies and the existing throughput limits remain. Request and approval table recovery settings are unchanged.

Expiry is an application visibility boundary, **not a promise of physical deletion exactly at day 30**. DynamoDB deletes expired items asynchronously; pending items can remain stored and incur storage/read charges. PITR is a separate recovery copy window, not an extension of visibility or authorization. No restored audit record may create a customer link or revive a consumed invitation. See [AWS expired-item behavior](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/ttl-expired-items.html) and [CloudFormation TTL configuration](https://docs.aws.amazon.com/AWSCloudFormation/latest/TemplateReference/aws-properties-dynamodb-table-timetolivespecification.html).

## Validation evidence boundary

Current `infra/aws/customer-enrollment/state.template.json` SHA-256:

```text
573fe2694bab405740ab93f71c0b912b3c667229ca7f2bbf6e60e9db9d84f775
```

The prior validated template is preserved byte-for-byte at [enrollment-state-pre-retention.template.json](enrollment-state-pre-retention.template.json), SHA-256:

```text
58881cef3da86e8dcff4119e3475a5ca9c2ee7078cba2879289118f5b0bd9cbd
```

The previous cfn-lint/Guard report and scoped policy treatment apply only to that historical hash. They were **not repinned to the new source**. The default exception checker deliberately rejects the changed template. `--historical` verifies the archived evidence only; its CI result is not a current-template deployment gate. A regression test requires current-source rejection.

Fresh cfn-lint and Guard validation of the current hash remains required, followed by review of actual resource changes, policy treatment and costs before execution. The local invariant checker is not a substitute for these tools. No current CloudFormation change set or live IAM test is claimed.

## Tests

- Final Windows workspace build, typecheck and lint: passed.
- Windows regression suite: 151 tests, 148 passed, three POSIX-only skips, zero failures.
- Four retention-specific cases cover exact expiry/TTL, asynchronous-deletion visibility, snapshot expiry preservation/copy isolation, and malformed/legacy/future/extended records.
- Historical policy evidence tests: 14 passed, including rejection of stale evidence for the current template.
- Current storage-plan invariant checks: passed; explicitly report schema and Guard validation as incomplete.
- Final-source Linux Docker build: passed frozen-lockfile installation, all workspace builds, customer bundle and all three separated enrollment bundles. Image manifest-list digest: `sha256:32280cb1e7592f5246705025263ad550affb154282b8735ab3d70615e5f008db` (`flo-audit-retention:local`).
- Linux regression suite in that image with external networking disabled: 151 tests, 150 passed, one Windows-only skip, zero failures. Only nonsecret runtime-test configuration files were bind-mounted read-only.
- Actual Docker Compose DynamoDB Local contract: passed, including persisted audit expiry/TTL and snapshot filtering, fixed-identity approval, wrong-customer isolation, forged approval rejection, eight-way redemption/replay checks, audit-collision rollback, expiry, revocation and logout. The internal test network used synthetic identities and in-memory data, not AWS IAM or live customer records. This does not verify AWS's background TTL deletion timing or a hosted enrollment flow.
- Built approval/request/redemption artifact smoke tests: passed with networking disabled and no AWS credentials; missing/expired designation and unauthenticated/malformed operations failed closed. An initial repeat invocation omitted required artifact-path arguments and exited before loading the bundle; rerunning with the documented built artifact paths passed.
- Operator boundary generator tests: two passed (separate from the 151-test application suite). These are local generator checks, not live MFA/authorization proof.
- `git diff --check`: passed; Git reported existing LF/CRLF normalization warnings, not whitespace errors.

The two temporary Compose containers and their project-specific internal network were removed after the run. Only disposable in-memory synthetic test data was discarded. The local Docker image remains available; no live data or AWS resources were removed.

Repeat the artifact smoke checks inside the image with these commands:

```text
node scripts/smoke-enrollment-approval-bundle.mjs /app/dist/customer-enrollment/approval/index.mjs
node scripts/smoke-enrollment-bundles.mjs /app/dist/customer-enrollment/request/index.mjs /app/dist/customer-enrollment/redemption/index.mjs
```

An initial lint run found an unused binding in a new test; it was corrected before the final successful build/lint/regression run. No test was removed or disabled to obtain a passing result.
