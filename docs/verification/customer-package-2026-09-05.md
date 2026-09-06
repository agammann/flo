# Customer application package — September 5, 2026 (Pacific)

> Historical pre-upload checkpoint. The exact ZIP was subsequently approved, privately uploaded, read back byte-for-byte, and bound to a review-only customer change set. See [artifact and change-set verification](customer-staging-review-2026-09-05.md). The customer runtime remains undeployed; statements below about no upload/version describe this earlier packaging checkpoint.

## Outcome and scope

The customer deployment ZIP was prepared and tested in the existing CloudShell Linux/Docker environment. Final checks completed around September 6, 00:04 UTC (September 5 Pacific). **No application package has been uploaded to S3, and no customer-runtime change set or website has been created.** The live narrator and its model allowance were not used. Devpost submission and video publication remain paused.

## Candidate identity

- ZIP SHA-256: `744a3e67d9bc003479cbf95d015b6ac3d696cae7ae687e5b36a7514610a57cc3`.
- ZIP size: **615,803 bytes**.
- Proposed S3 key: `flo-customer/744a3e67d9bc003479cbf95d015b6ac3d696cae7ae687e5b36a7514610a57cc3.zip`.
- Proposed bucket: `flo-customer-artifacts-artifacts-wiyewwqt3d1r`, previously approved and deployed in us-west-2.
- Candidate retained in CloudShell at `/home/cloudshell-user/flo-customer-release-744a3e67/744a3e67d9bc003479cbf95d015b6ac3d696cae7ae687e5b36a7514610a57cc3.zip`, alongside its per-file manifest and source manifest. This is CloudShell storage, not a public URL or an S3 upload. CloudShell home retention is not a permanent release archive.
- No S3 object version exists yet; it must be captured from a separately approved upload and bound in the deployment parameters.

Exactly seven regular files are included:

| File | SHA-256 |
| --- | --- |
| index.mjs | ef6c024657c3ec809cbc6a5c2cd2f8f2865c48203a1e1e6594085d4670062dec |
| package.json | d218e29ec01186542b0d85bdc6691d12514e4cdd0ba3b9cd81f253250c8d1e34 |
| public/privacy.html | 3d491f9fd3200bc13957a7df5fead09f95ee6cef6a965fe47fa143c539c97d90 |
| public/signin.css | a6abcf1047aff331e2b47d5e8d7321d88ddc151a2505b71a60d43d08e8f75ac2 |
| public/signin.html | 62b65ca8f3a90e92892fc60cae6d5cc90168a457179186c1cbd0307dc2372433 |
| public/signin.js | f6bcd232457bd11f67117ba8ef82e562a31ec0659df26ef01e925fa56e442e21 |
| public/terms.html | c94adc6f7c2379ff52c580157ef26f99de59f5fef96c305a2b2519435b53f9e3 |

No `.env`, Git metadata, test fixture, local customer-link file, separate credential file or source map is packaged. The bundle necessarily contains SDK/application code referencing credential configuration names; those names are not secret values. High-signal AWS-access-key/private-key marker checks passed. This limited pattern check is not a comprehensive secret audit.

## Source provenance and reproducibility

- Rechecked image ID: `sha256:9a87c62d699681dc5cff25bb867ebcdfb66689b8884c7fa7738d7578f7728e3c`, the image in the [earlier Docker report](cloudshell-docker-2026-09-05.md).
- `scripts/customer-source-manifest.mjs` generated SHA-256 records for 80 current runtime/build/public-asset files. Seventy-nine matched files in the image exactly. Dockerfile is deliberately not copied into the image; its checksum separately matched the archived build input. The initial all-files image check reported only that missing Dockerfile, not a runtime-source divergence.
- Source archive `flo-customer-validation-source.tar.gz` still hashed to `58a402465e0abe213f735d6ad9c4a51a71de9c5efe17d8024015c3e3969b5989`.
- Runtime bundle copied from an unstarted container made from that exact image. The temporary container was verified in Created state and removed after copying; no running workload was removed.
- `scripts/package-customer-staging.py` restricts the archive to the seven expected regular files, checks the expected entrypoint hash, rejects symlinks, verifies package metadata, tests ZIP integrity and compares every archived byte to its source. ZIP entry timestamps and permissions are fixed.
- A second packaging run produced a byte-for-byte identical ZIP. This proves repeatable ZIP packaging of this bundle in this environment, not independently reproducible compilation on every platform.

## Fresh verification

| Check | Result |
| --- | --- |
| Full workspace build | Passed |
| Full regression suite | 93 passed, 0 failed, 0 skipped; 16 suites |
| Typecheck | Passed, 13 configurations |
| ESLint | Passed with zero warnings allowed; new packaging/smoke JavaScript also checked |
| ZIP integrity and per-file readback | Passed |
| Second ZIP comparison | Identical |
| Extracted ZIP landing/privacy/terms/JS/CSS | All returned 200; nonempty responses and CSP headers |
| Privacy identity text | Alexander Ammann and xyes47314@gmail.com present |
| Disabled-login session GET | 503 |
| Disabled-login start POST | 403, rejected by the POST/origin guard before the unavailable-provider branch |
| Separate `/alexa/mcp` route | 401 |
| Malformed payload-v2 input | 503 |

The first smoke script incorrectly expected 503 for the disabled-login POST. Source inspection confirmed the existing guard returns 403 when no auth provider is configured. Only that test assertion was corrected; the application ZIP was not changed. The corrected smoke test passed with exit 0.

`scripts/smoke-customer-bundle.mjs` ran against the **extracted ZIP**, not the workspace source, inside a read-only Node 22.23.2 container with `--network none`, all Linux capabilities dropped, no-new-privileges and no AWS or LWA credentials. All temporary test containers were removed (`docker ps -a` returned no entries afterward). This proves packaging and fail-closed route behavior in Linux; it is not a live Lambda/API Gateway, managed DynamoDB or real Amazon sign-in test.

## Proposed next step — upload and review only

After separate approval:

1. Recheck the ZIP checksum and exact private bucket. Upload this one ZIP without public ACLs, with SSE-S3 and a checksum; do not overwrite a different package or publish files.
2. Capture its S3 VersionId. Verify that exact version's size/checksum/encryption and compare a downloaded copy to the candidate. Do not print credentials or presigned URLs.
3. Prepare a **review-only CREATE change set** for `flo-customer-staging` using `infra/aws/customer-staging/template.yaml`, SHA-256 `193c9ff75f88db2661ba9d6aa0c354d4cddefdda99fc51341477f472252deafa`, and the exact bucket/key/version.
4. Set `LwaEnabled=false`, with empty LwaClientId and LwaSecretId. Do not create real LWA credentials, customer links or repair records during this preparation.
5. Review CloudFormation events, exact resources/IAM and current capacity/costs before requesting execution approval.

The source proposes 14 resources: three DynamoDB tables, one generated auth-state secret, one HTTP API, two seven-day log groups, a role and managed policy, one Lambda with reserved concurrency 1, integration, route, stage and invoke permission. It contains no DLQ, VPC or Bedrock calls. These would **not** be provisioned by preparing the change set. The upload itself adds S3 storage/request usage; the website/database/secret costs start only if their separate deployment is approved and executed.

The source template's prior lint/Guard results and approved staging policy exceptions remain in the earlier infrastructure review. Refresh validation and confirm the exact hash before change-set preparation. Never fetch generated secret values into chat or local files. The later hosted phase must verify real LWA, trusted customer-to-repair mapping and service/user separation before any claim of completed customer sign-in or Alexa+ account linking.
