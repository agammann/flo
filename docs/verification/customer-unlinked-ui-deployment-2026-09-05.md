# Unlinked-account UI deployment — September 5, 2026 (Pacific)

> Subsequent browser verification: the owner reported successful sign-in/sign-out, and the agent directly inspected the hosted page showing the exact authenticated-unlinked message, Sign out visible, and no sign-in prompt or repair controls. The pending-browser statements below describe the earlier deployment checkpoint. Signed-in repair API denial and trusted customer enrollment remain distinct uncompleted live tests; see [the next test gate](customer-enrollment-next-step-2026-09-05.md).

## Outcome

The owner explicitly approved executing the reviewed UI-only change set. Deployment succeeded. Hosted HTML and JavaScript match the approved artifact, and all 16 bounded pre-login checks passed. **The fresh real authenticated-unlinked screen and logout still require the owner to sign in again**: navigating the open browser to Flo's current home page returned the sign-in-required state, not a valid session.

No customer mapping, repair record, authentication rule, secret value, narrator resource, Devpost submission or video publication was changed. The browser test did not bypass Amazon login or fabricate a user session.

## Execution and AWS verification

- Account `114599789754`, region `us-west-2`; STS verified before execution.
- Change set `flo-customer-unlinked-ui-20260906T025712Z`.
- ARN `arn:aws:cloudformation:us-west-2:114599789754:changeSet/flo-customer-unlinked-ui-20260906T025712Z/5f4ed808-beb9-4736-af7e-86be1a0a2dfe`.
- Final preflight: CREATE_COMPLETE / AVAILABLE; exactly one CustomerFunction Modify with no replacement, and only Code.S3Key / Code.S3ObjectVersion changed. Zero validation errors. Previous stack UPDATE_COMPLETE.
- ExecuteChangeSet token `flo-unlinked-ui-owner-approved-20260906T025712Z`.
- Operation `4742d786-3355-420e-9376-d194593d5415`; operation-scoped DescribeEvents reports UPDATE_STACK SUCCEEDED at **2026-09-06T03:01:03.938000+00:00**.
- Stack UPDATE_COMPLETE; Lambda Active / LastUpdateStatus Successful.
- Lambda CodeSha256 `Ga0n1RONKyYdMyn7Abo36y5D6S+pKylpkzZKuldc6sU=` equals approved ZIP SHA-256 `19ad27d5138d2b261d3329fb01ba37eb2e43e92fa92b296993364aba575ceac5` (verified locally as base64).
- Code size 616,093 bytes; runtime nodejs22.x, 512 MB, 25-second timeout unchanged.

Artifact provenance, version, two changed UI files, unchanged backend bytes, costs, and prior template validation are in [the review](customer-unlinked-ui-review-2026-09-05.md). Selected allowlisted AWS evidence is in [deployment JSON](customer-unlinked-ui-deployment-2026-09-05.json). No function environment or secret values were recorded.

## Hosted checks

Updated only the two expected asset hashes in `scripts/smoke-customer-lwa-hosted.mjs`; targeted ESLint passed. Running it against the explicit approved origin passed all 16 sequential checks, paced 1.1 seconds apart:

- Landing, privacy, terms, JavaScript and CSS: 200 and SHA-256 match the approved assets.
- No-cookie and synthetic-cookie session: 401 SIGN_IN_REQUIRED.
- Synthetic callback without valid browser state: 401.
- Login initiation without consent: 400; untrusted origin: 403.
- Repair command without session: 401; fabricated service Authorization plus customer/role overrides: 401.
- Website MCP with fabricated bearer: 401; separate Alexa/customer/general MCP routes: 401.
- Every response preserved no-store, no-referrer, nosniff and CSP headers, issued no redirect and set no cookies; rejected responses returned no customer data.

The fabricated service header tests rejection of a negative input, not a valid IAM-authenticated caller. These requests do not establish real provider sign-in, linked-customer access, or official Alexa+ linking.

## Browser state and remaining test

The open tab initially still displayed the old rendered page. Ctrl+R did not produce a new accessibility tree. Clicking the actual Flo home link navigated to the current page; it displayed “Please sign in to access your repairs,” no repair panel, and consent unchecked. Sign out was absent in this signed-out state, as expected.

The owner must complete Amazon login/Allow again without sharing credentials or callback tokens. Then verify the exact shop-verification message, absence of the sign-in prompt and repair controls, and presence of Sign out. A real signed-in repair request must still be rejected before shop linkage, and logout must invalidate the session. Do not claim these fresh authenticated checks complete from deployment success or the local UI tests alone.

Prior local evidence remains 101 tests/17 suites, full build/typecheck/lint, and isolated Docker package smoke. The full suite was not rerun during this deployment-only turn. Submission and video publication remain paused.
