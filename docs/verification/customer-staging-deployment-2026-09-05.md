# Customer staging deployment — September 5, 2026 (Pacific)

Historical initial-deployment findings. The separately approved concurrency update subsequently resolved the reproduced browser/parallel-load blocker in bounded tests; see [current verification](customer-concurrency-deployment-2026-09-05.md). LWA remains disabled and real sign-in remains unverified.

## Outcome: deployed, but browser-load reliability is not ready

The owner approved execution of the exact reviewed customer change set and HTTPS/configuration/logging/rejected-access verification, with LWA disabled and release publication paused. **CREATE_COMPLETE** is confirmed. The serial hosted smoke passed, but a parallel asset test reproduced Lambda throttling and gateway HTTP 503s. **Do not call the website ready, enable login, or submit this as completed customer access.** No concurrency increase was applied.

## Exact deployment

- Account `114599789754`, region `us-west-2`; current caller verified as account root. Prefer a least-privileged deployment identity before production.
- Stack `flo-customer-staging`; change set `flo-customer-staging-review-20260906T0017Z`, ARN suffix `640ddf37-908b-4f8c-883b-1b70f3a69d51`.
- ExecuteChangeSet succeeded with client token `flo-customer-owner-approved-20260906`.
- CREATE_STACK operation `e52da7e2-9874-4099-9254-752e706f137d` succeeded at **2026-09-06 00:49:17.355 UTC**, starting 00:48:17.820 UTC. All 14 resources are CREATE_COMPLETE. DescribeEvents returned no failed events for this operation.
- Template SHA-256 `193c9ff75f88db2661ba9d6aa0c354d4cddefdda99fc51341477f472252deafa`; S3 version `3pbmv1gha2sCK7UPUi7bZ_1q8QjtPPTX`.
- Live Lambda CodeSha256 `dEo+Z9m8ADR5y/ldAVtqw9aWyueuaH5bNqdRRhClfMM=`, size 615,803 bytes, matches the reviewed ZIP. [Pre-deployment evidence](customer-staging-review-2026-09-05.md).

Public outputs:

- [Staging website](https://i4ceh4qpdg.execute-api.us-west-2.amazonaws.com/).
- [Privacy notice](https://i4ceh4qpdg.execute-api.us-west-2.amazonaws.com/privacy), identifying Alexander Ammann and xyes47314@gmail.com.
- [Preview terms](https://i4ceh4qpdg.execute-api.us-west-2.amazonaws.com/terms).
- Exact future LWA callback: `https://i4ceh4qpdg.execute-api.us-west-2.amazonaws.com/auth/lwa/callback`.

LWA remains disabled; client ID and secret-reference parameters are empty. The generated state secret has an AWSCURRENT version (metadata only read). No secret values or Lambda environment values were returned to chat. No LWA profile, customer links, repair records, narrator/model calls, allowance changes, Devpost or YouTube changes occurred.

## Runtime controls read back from AWS

| Control | Live result |
| --- | --- |
| Lambda | Active, update Successful, Node.js 22, x86_64, index.handler, 512 MB, 25-second timeout |
| Reserved concurrency | **1**; regional quota 1,000, now 997 unreserved |
| API | HTTP API i4ceh4qpdg, payload-v2 AWS_PROXY, integration timeout 29,000 ms, automatic default-stage deployment |
| API throttle | Rate 2, burst 5; unchanged |
| Invocation policy | API Gateway service principal, exact API ARN and source account |
| IAM role | Lambda trust, no inline policies, one managed policy v1 |
| Runtime permissions | Auth Get/Put/Delete only; links Get only; repairs Get/Query only; log-stream creation/writes only to its function log group |
| Logs | Both groups retain seven days; access fields exactly requestId/status/latency; no explicit customer-managed log key |
| DynamoDB | All three ACTIVE, PAY_PER_REQUEST, deletion protection true, max read 10/write 5 request units |
| Table encryption | ENABLED, KMS; key dd2b8d6c-5d80-4461-b4fe-a4780bc9b2a4 independently confirmed KeyManager AWS and Enabled |
| Auth recovery | TTL enabled on ttl; point-in-time recovery DISABLED |
| Link/repair recovery | Point-in-time recovery ENABLED, seven-day period |
| Initial records | Strongly consistent COUNT-only scans returned Count=0/ScannedCount=0 for all three tables |
| Other surfaces | No Function URL configurations or event-source mappings; no DLQ or customer VPC configuration returned |

COUNT-only scans used the deployment caller, not the Lambda role. The application has not yet exercised real authenticated DynamoDB session operations or encryption roundtrips. Enabled recovery settings are not proof of a tested restore. Authentication state must never be restored to undo logout.

## Serial live HTTPS smoke

`node scripts/smoke-customer-hosted.mjs https://i4ceh4qpdg.execute-api.us-west-2.amazonaws.com` completed with exit 0: **16 checks passed**, about 01:04–01:05 UTC. Requests were serialized with a delay and no real credentials/customer data.

- GET landing/privacy/terms/JS/CSS: 200 and exact packaged byte hashes.
- GET session, synthetic invalid cookie, and synthetic callback: expected application 503 (108-byte explicit login-unavailable response).
- POST login start/logout/customer command, wrong-origin staff-role header, synthetic bearer MCP request: 403.
- GET `/alexa/mcp`, `/customer/mcp`, `/mcp`: 401.
- All checked responses had no-store, CSP, nosniff, no-referrer and HSTS; no session cookies or Amazon redirects.

These are disabled-configuration rejection tests, **not** actual expired Amazon credentials, genuinely linked wrong-customer access, successful login/logout, or an AWS-signed service request. Header/bearer values were synthetic. Real provider, ownership and service/user separation tests remain mandatory.

Access logs matched all 16 request IDs/statuses and contained only requestId/status/latency. A fully paginated, bounded-time Lambda log read returned **49 events, 16 REPORT records, zero checked error markers** (ERROR, Task timed out, Runtime.ImportModuleError). An earlier limited query returned no function events plus a pagination warning; the subsequent complete bounded query resolved that evidence gap. Arbitrary function log bodies were not emitted into chat.

## Reproduced reliability blocker

The browser rendered the page but remained on **Checking sign-in availability…** with login disabled, including after a deliberate reload. Serial endpoint success did not establish working browser initialization.

A bounded one-shot parallel GET test returned:

| Path | Status | Bytes | API request ID |
| --- | --- | --- | --- |
| `/` | 503 | 33 | DQJ5FicxPHcEJKA= |
| `/signin.css` | 503 | 33 | DQJ5FiQhPHcEJpA= |
| `/signin.js` | 200 | 3763 | DQJ5FgzHPHcEJZA= |

The gateway 503s differ from the intentional 108-byte login-disabled response. Access logs independently matched both failed IDs at timestamp 1788656902487. Lambda Throttles showed Sum=2 at 01:08 UTC, plus Sum=1 at 01:06 and 01:07; returned ConcurrentExecutions points peaked at 1. No throttles appeared in returned 01:04/01:05 serial-test points. Combined with reservation 1, this supports the diagnosis that concurrent asset requests collide at the Lambda limit.

Recommended scoped next candidate: review a customer-only reserved-concurrency change **1 to 3**, keeping API rate 2/burst 5, database limits, LWA disabled, and other security controls unchanged. Then repeat parallel and browser checks. Three is a bounded test candidate, not proven production capacity. Separating static asset delivery is a broader alternative.

Reserved concurrency has no separate reservation fee, but greater simultaneous execution can increase usage; it is not a hard spending cap. [AWS concurrency documentation](https://docs.aws.amazon.com/lambda/latest/dg/configuration-concurrency.html). API Gateway throttles are best-effort targets, not guaranteed ceilings. [HTTP API throttling](https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-throttling.html).

No update was prepared or executed in this turn. Obtain approval, validate revised source and review the exact CloudFormation update before changing the live reservation.

## Local changes and next gates

Added the credential-free exact-origin hosted smoke script and this report. Initial script lint flagged unqualified globals; changed to imported Buffer and globalThis.fetch/AbortSignal, then targeted lint passed. Runtime/template/ZIP bytes were unchanged; no new full regression run is claimed. The package report records the preceding 93 tests and Docker verification.

The approved initial deployment is complete; browser reliability remains blocked. After correction, configure real LWA at the exact callback, independently verify and provision test identity/customer links, and test real hosted success/rejection. Website login is not Alexa+ account linking. Official testing/certification, fresh GitHub CI, accurate release materials and replacement-video review remain unfinished. **Submission and video publication stay paused.**
