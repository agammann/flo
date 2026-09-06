# LWA enablement deployment — September 5, 2026 (Pacific)

## Outcome

The owner explicitly approved executing the reviewed change set and proceeding to a controlled hosted Amazon sign-in test. The AWS update completed successfully. **Real Amazon sign-in and the signed-in unlinked-account denial are not yet verified; the owner must complete the browser sign-in step.** No customer mapping or repair data was written, and no Devpost submission or video publication occurred.

## Approved execution

- Account `114599789754`, region `us-west-2`; STS reverified the caller/account before execution.
- Stack: `flo-customer-staging`.
- Change set: `flo-customer-lwa-review-20260906T023152Z`.
- ARN: `arn:aws:cloudformation:us-west-2:114599789754:changeSet/flo-customer-lwa-review-20260906T023152Z/f4eb1cef-5d0c-42ad-8ed0-b42ffed26688`.
- ExecuteChangeSet request token: `flo-lwa-owner-approved-20260906T023152Z`.
- Stack operation: `aab8e492-7214-4e49-90c4-f5d936028480`.
- UPDATE_STACK succeeded at **2026-09-06 02:38:18.868 UTC**.

Preflight rechecked CREATE_COMPLETE/AVAILABLE and zero change-set validation errors. The basic change-set view listed an API integration dependency, but `IncludePropertyValues=true` again resolved the plan to exactly the approved CustomerFunction update and its five reviewed changed paths. No additional property change or replacement was present. The prior lint/Guard checks and approved exceptions are in [the review](lwa-enablement-review-2026-09-05.md).

## Live AWS verification

- CloudFormation: **UPDATE_COMPLETE**.
- Parameters bind the corrected ZIP key and exact S3 version `raKQgS0ARCNPg5kSiao.DIgrcXy7KP._`.
- `LwaEnabled=true`; public client ID and existing LWA secret reference match the registered profile/review.
- Lambda: **Active**, **LastUpdateStatus=Successful**.
- Code size **615,855 bytes**; `CodeSha256=Rh9eFZG3YQuhul+j1oHW/ohjhrFr6mPq2XgYleYA67Y=` — exact approved ZIP digest.
- Runtime `nodejs22.x`, handler `index.handler`, memory **512 MB**, timeout **25 seconds**.
- Reserved concurrency: **3**, unchanged.

Only allowlisted function metadata was returned during verification; environment contents were not displayed or recorded. No GetSecretValue/BatchGetSecretValue call was made. Stack/runtime success is not proof that Amazon will accept the stored credential. Its previous conversation disclosure and rotation recommendation remain documented.

## Hosted checks completed

`scripts/smoke-customer-lwa-hosted.mjs` made 16 sequential requests against the explicit approved origin, approximately 1.1 seconds apart. All passed, with no provider exchange, login initiation, cookie jar or real credentials. The script's explicit Node globals/imports were subsequently adjusted to satisfy ESLint; lint passed and no deployed package bytes changed.

| Check | Observed |
| --- | --- |
| Landing, privacy, terms, JS and CSS | Five 200 responses; SHA-256 hashes equal packaged assets |
| Session without cookie | 401 SIGN_IN_REQUIRED |
| Session with synthetic 43-character cookie | 401 SIGN_IN_REQUIRED |
| Synthetic callback without valid browser state | 401 |
| Login start without consent | 400 |
| Login start with untrusted origin | 403 |
| Customer command without session | 401 |
| Command with synthetic service Authorization and customer/role overrides | 401, no customer data |
| Website MCP with fabricated bearer value | 401 |
| Separate Alexa/customer/general MCP routes | Three 401 responses |

All responses retained no-store/no-referrer/nosniff/CSP headers, set no cookies and issued no redirect. The fabricated service header is a negative input test, not proof of an actual valid IAM-authenticated caller's behavior. Request IDs are preserved in [selected nonsecret deployment evidence](lwa-enablement-deployment-2026-09-05.json).

The real browser was refreshed after deployment. Its status changed from “Login with Amazon is not configured” to **“Please sign in to access your repairs.”** The consent checkbox remains unchecked and the login button correctly stays disabled until consent is selected. No Amazon account consent was accepted by the agent.

## Immediate user-controlled test

Open [the hosted Flo site](https://i4ceh4qpdg.execute-api.us-west-2.amazonaws.com/), review and select the consent checkbox, then continue to Login with Amazon. The owner must control Amazon credentials/MFA/consent and return to Flo. Do not paste credentials, tokens, or the callback URL into chat.

After the callback, verify that a successfully authenticated but unlinked Amazon identity receives CUSTOMER_NOT_LINKED and cannot obtain repairs, then test logout. Establish any shop-customer mapping only after independent verification; do not automatically link by email, displayed name or a supplied repair number.

Real sign-in, signed-in unlinked denial, hosted wrong-customer isolation, hosted credential expiry/revocation/logout, independently verified test mappings, official Alexa+ service/user linking, certification and release publication are not claimed complete by this deployment. The prior synthetic regression suite remains separate evidence. Submission and video publication remain paused.
