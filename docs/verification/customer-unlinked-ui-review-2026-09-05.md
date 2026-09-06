# Unlinked-account UI staging review — September 5, 2026 (Pacific)

> Subsequent outcome: the owner approved execution; the update succeeded and all 16 hosted pre-login checks passed. The real browser requires renewed sign-in before authenticated-unlinked verification. See [deployment evidence](customer-unlinked-ui-deployment-2026-09-05.md). The unexecuted statements below describe the earlier review checkpoint.

## Status: prepared, not executed

The owner asked to move forward with the tested UI correction. The new seven-file application ZIP was uploaded privately and a review-only change set was prepared. **No ExecuteChangeSet call was made; the running site is unchanged.** No secrets were retrieved, customer mappings written, repair records changed, or release submitted/published.

## Artifact provenance and verification

- Account `114599789754`, region `us-west-2`; verified through STS.
- Bucket `flo-customer-artifacts-artifacts-wiyewwqt3d1r`: versioning enabled, all four public-access blocks true, nonpublic policy status, correct region.
- Candidate SHA-256: `19ad27d5138d2b261d3329fb01ba37eb2e43e92fa92b296993364aba575ceac5`.
- Key: `flo-customer/19ad27d5138d2b261d3329fb01ba37eb2e43e92fa92b296993364aba575ceac5.zip`.
- Version: `xKCi0sczMSbYU_8FlvNzzn988t9ZD21g`; size **616,093 bytes**; SSE-S3 AES256; application/zip.
- Exactly two files differ from the previous deployed package: `public/signin.html` and `public/signin.js`. Server entrypoint, package metadata, CSS, privacy and terms match byte-for-byte by SHA-256. No authorization changes are included.
- Packaging allowlisted exactly seven files, validated archive contents, and applied its limited credential-pattern check (not a comprehensive secret audit).
- Upload used a five-minute object-scoped presigned PUT, expected bucket owner, explicit encryption and `If-None-Match: *` to refuse overwrite. No public ACL was added. A separate five-minute version-scoped download matched the candidate SHA-256. Signed URLs were not recorded in repository evidence.
- Connector HeadObject independently verified the version, size and encryption.
- The downloaded ZIP was extracted locally and passed `smoke-customer-lwa-config.mjs` in Docker Node 22.23.2 with read-only mounts and networking disabled. No real provider or AWS calls were involved in that smoke test.
- The preceding source verification passed 101 tests in 17 suites, build, typecheck and lint; see [UI test evidence](customer-unlinked-ui-2026-09-05.md). Those full tests were not rerun in this artifact-review turn.

## Exact CloudFormation plan

- Name: `flo-customer-unlinked-ui-20260906T025712Z`.
- ARN: `arn:aws:cloudformation:us-west-2:114599789754:changeSet/flo-customer-unlinked-ui-20260906T025712Z/5f4ed808-beb9-4736-af7e-86be1a0a2dfe`.
- Stack: `flo-customer-staging`; UPDATE using `UsePreviousTemplate=true`.
- CREATE_COMPLETE / AVAILABLE; DescribeEvents records CREATE_CHANGESET SUCCEEDED at `2026-09-06T02:57:20.473000+00:00` and **zero VALIDATION_ERROR events**.
- DescribeChangeSet with property values resolves to **one Modify: CustomerFunction**, replacement False, all recreation requirements Never.
- Only changed property paths: `/Properties/Code/S3Key` and `/Properties/Code/S3ObjectVersion`.
- All other stack parameters use their previous values, including existing real LWA configuration. No environment values were displayed.
- No additions, removals, replacements, IAM changes, encryption changes, concurrency changes or database changes.

The unchanged local template hash remains `87d753a04241749a438d24528b3282c8100fe4dd2e686e0bcd15613d5878ad96`. The existing template's cfn-lint and Guard results and scoped exceptions are in [the prior infrastructure validation](lwa-enablement-review-2026-09-05.md). These are reused historical template-level checks, not a claim of freshly rerun lint/Guard. Fresh AWS change-set validation is recorded above.

## Live preflight and costs

Before preparation: stack UPDATE_COMPLETE, Lambda Active / LastUpdateStatus Successful; deployed digest remains `Rh9eFZG3YQuhul+j1oHW/ohjhrFr6mPq2XgYleYA67Y=`. Runtime nodejs22.x, memory 512 MB and timeout 25 seconds are unchanged. The previous ZIP/version is retained.

The upload adds one retained 616 KB deployment artifact and ordinary S3 requests/storage. Executing the plan introduces no new services or configured capacity; existing staging usage and verification calls remain billable under the account's pricing. This is not a no-cost claim or a hard spending cap.

## Explicit execution gate

Request owner approval to execute this exact change set. Then recheck status and changed paths, execute, verify Lambda package digest and hosted asset hashes, and test the real authenticated-unlinked screen and logout. Do not equate website login with repair ownership or official Alexa+ account linking. Devpost submission and video publication remain paused.
