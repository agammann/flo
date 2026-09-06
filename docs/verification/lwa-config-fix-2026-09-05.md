# LWA configuration fix and replacement package — September 5, 2026 (Pacific)

> Subsequent checkpoint: the owner approved the private upload and review-only change-set preparation. Both are complete; the plan remains unexecuted and login disabled. See [LWA enablement review](lwa-enablement-review-2026-09-05.md). Statements below about no upload/change set describe the earlier package checkpoint.

## Outcome

Reproduced and fixed a pre-provider credential-validation failure while preparing real Login with Amazon enablement. The corrected package is built and tested locally, including isolated Linux Docker checks. **It has not been uploaded to S3 or deployed. No new enablement change set has been created or executed.**

AWS `DescribeStacks` freshly returned `flo-customer-staging` as `UPDATE_COMPLETE`, with `LwaEnabled=false`, empty public client-ID/secret-reference parameters, and the previous `744a3e67...` package. `DescribeSecret` returned the existing `flo/customer-staging/lwa` version as `AWSCURRENT`, with no deletion scheduled. This was metadata-only verification, not a secret read or a credential-validity check.

## Root cause and fix

The deployed validator rejects secrets longer than 64 bytes. A synthetic provider prefix plus 64-character payload reproduced the failure before network access. The old [LWA Security Profile page](https://developer.amazon.com/docs/login-with-amazon/security-profile.html) describes that limit, while [Amazon's current LWA credential example](https://developer-docs.amazon/sp-api/docs/onboarding-step-5-make-your-first-call-to-the-sp-api-sandbox) shows prefixed credentials. The latter is an SP-API onboarding example, not the Flo API contract.

The corrected validator accepts nonempty printable-ASCII credentials up to a **Flo-defined 1024-byte safety bound**. It does not trim, strip prefixes, or truncate. This bound is not represented as an official Amazon maximum. The public client-ID and canonical HTTPS-origin checks remain unchanged.

Only synthetic generated credentials are used in regression fixtures. The existing owner-supplied credential is not copied into the tests, bundle, or this report. Its earlier disclosure and outstanding rotation recommendation remain documented in [the provisioning record](lwa-secret-provisioning-2026-09-05.md).

## Verification completed

| Check | Result |
| --- | --- |
| Full workspace build | Passed, 13 configurations |
| Full regression suite | 94 passed, 0 failed, 0 skipped, 16 suites |
| Typecheck | Passed, 13 configurations |
| ESLint | Passed with zero warnings allowed |
| Opaque credential boundaries | Accepts synthetic 64/65-byte, prefixed, and 1024-byte values unchanged; rejects blank, whitespace/control/non-ASCII and 1025-byte values |
| Mocked Amazon token exchange | Exact prefixed value forwarded unchanged; expected client ID, callback, PKCE, audience and subject checked |
| Customer security regressions | Wrong customer, unlinked account, expiration, revocation, logout, cross-instance races, service/header overrides continue passing |
| ZIP packaging | Exactly seven allowlisted files; integrity and every archived byte verified against the bundle |
| Extracted ZIP, Windows | Public assets and fail-closed disabled-login routes passed |
| Extracted ZIP, Linux Docker | Disabled-login smoke passed; synthetic enabled-config initialization passed and missing session still returned 401 |

Docker Desktop engine `29.7.2` was reachable in this turn. The official Node `22.23.2-bookworm-slim` image was pulled and used by digest `sha256:83f487e0a63425e5b4d146fb5e5be574bcbe1b7b843d3ebafdd95eaf7767a7e5`. Both test containers used `--network none`, read-only root/bind mounts, no Linux capabilities, no-new-privileges, nonroot UID/GID 65534, no real credentials, and automatic container removal. The downloaded image remains available locally. This validates the extracted Lambda package in Linux; it is not a new full Docker Compose launch or hosted sign-in test.

The enabled-config smoke exercises the packaged runtime constructor using a synthetic prefixed credential: landing returns 200, session without a cookie returns `401 SIGN_IN_REQUIRED`, and `/alexa/mcp` returns 401. It makes no provider/database calls and cannot establish actual credential validity or repair ownership.

## Candidate identity

- ZIP SHA-256: `461f5e1591b7610ba1ba5fa3d681d6fe886386b16bea63ead9781895e600ebb6`.
- ZIP size: **615,855 bytes**.
- Bundle entrypoint SHA-256: `30f9aeccc8b04a079331b492e92cee932d84f7376e268b9b75932b1c14d128ed`.
- Local ZIP and per-file manifest: `dist/customer-lwa-release/` (generated, ignored output).
- Proposed S3 key: `flo-customer/461f5e1591b7610ba1ba5fa3d681d6fe886386b16bea63ead9781895e600ebb6.zip`.
- Proposed existing private bucket: `flo-customer-artifacts-artifacts-wiyewwqt3d1r` in us-west-2.
- No new S3 version exists yet. Do not substitute the old package version.
- Source template SHA-256 remains `87d753a04241749a438d24528b3282c8100fe4dd2e686e0bcd15613d5878ad96`; no template edits were required for this fix.

The six non-entrypoint packaged files have the same SHA-256 values as the previous package: package metadata and the five public landing/style/script/privacy/terms assets are unchanged. The packaging script's limited AWS-key/private-key marker checks passed; these are not a comprehensive secret audit.

## Next approval and deployment boundary

Request approval to upload the one corrected ZIP privately into the existing artifact bucket, read it back and record its exact version, then prepare a **review-only UPDATE change set** with:

- The new artifact key/version and unchanged bucket.
- `LwaEnabled=true`.
- Public `LwaClientId=LWA_CLIENT_ID_REDACTED_FROM_PUBLIC_EVIDENCE`.
- `LwaSecretId=arn:aws:secretsmanager:us-west-2:114599789754:secret:flo/customer-staging/lwa-hwN6ke` — reference only, resolved through the template's existing Secrets Manager dynamic reference.

Refresh template validation as required, retrieve change-set validation events, and review exact property changes, IAM, replacements/removals and costs before requesting **separate execution approval**. The upload adds S3 request/storage usage. It does not itself enable sign-in, authorize repairs, or provision a new website. Reserved concurrency 3, existing API/table limits, finite logs and approved no-VPC/no-DLQ treatment are to remain unchanged.

After approved execution, first test real hosted Amazon sign-in with an unlinked account and verify repair access is denied. Establish any test-customer association only after independent operator verification; Amazon identity alone never authorizes repair records. Actual linked-customer and rejected-access hosted tests, official Alexa+ service/user linking checks, submission and video release remain separate unfinished gates. Submission and publication stay paused.
