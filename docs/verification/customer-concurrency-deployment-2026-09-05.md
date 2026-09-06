# Customer concurrency deployment — September 5, 2026 (Pacific)

## Outcome: update complete; reproduced browser blocker resolved in bounded tests

The owner approved execution of `flo-customer-concurrency-review-20260906T014620Z` and the post-deployment checks. AWS reports **UPDATE_COMPLETE** and customer reserved concurrency **3**. The three-request parallel asset regression passed, all 16 serial hosted checks passed, and browser initialization completed on initial load and reload. **LWA remains disabled. This is not successful Amazon sign-in, customer-ownership verification, Alexa+ linking, certification, or production-capacity validation.**

## Deployment evidence

- Account `114599789754`, region `us-west-2`, stack `flo-customer-staging`.
- Approved change-set ARN suffix `986237ee-3afe-46e4-b354-69b27c56e6d7`; [pre-execution review](customer-concurrency-review-2026-09-05.md).
- ExecuteChangeSet succeeded with client token `flo-customer-concurrency-owner-approved-20260906`.
- UPDATE_STACK operation `adc1b482-b3d1-4786-b545-53a992054fd8` succeeded at **2026-09-06 01:51:00.545 UTC**, starting 01:50:52.993 UTC.
- DescribeEvents returned seven operation events, no failures; only CustomerFunction had resource-update events. The basic change-set view included a dynamic CustomerIntegration dependency; the property-value view resolved it away. The live integration URI was independently checked unchanged after deployment.
- Deployed Original template matches the exact reviewed local candidate, SHA-256 `87d753a04241749a438d24528b3282c8100fe4dd2e686e0bcd15613d5878ad96`.
- Customer Lambda Active / LastUpdateStatus Successful; reservation **3**. Applied regional concurrency 1,000; unreserved 995.
- Application checksum remains `dEo+Z9m8ADR5y/ldAVtqw9aWyueuaH5bNqdRRhClfMM=`, size 615,803 bytes; Node.js 22, 512 MB, 25-second timeout unchanged. No application code upload occurred.
- All six stack parameters unchanged, including exact artifact version `3pbmv1gha2sCK7UPUi7bZ_1q8QjtPPTX`, `LwaEnabled=false`, empty LWA client ID and secret reference.
- API integration `qfwnq4s` still points to the same Lambda ARN, payload v2, timeout 29 seconds. API rate 2/burst 5 and minimal access logging unchanged.
- No narrator/model calls, allowance resets, customer records, LWA configuration, GitHub pushes, Devpost submissions, or YouTube changes.

See [selected deployment and request evidence](customer-concurrency-deployment-2026-09-05.json). Function environment values and resource-property dumps are omitted from that evidence.

## Successful and rejected HTTPS checks

New regression command:

```sh
node scripts/smoke-customer-parallel.mjs https://i4ceh4qpdg.execute-api.us-west-2.amazonaws.com
```

It sends exactly three concurrent, credential-free GETs. At **01:52:15.525–01:52:16.739 UTC**, `/`, `/signin.css`, and `/signin.js` all returned **200**, matched the reviewed byte hashes, created no cookies, and issued no redirects. Exit 0. This reproduces the shape of the previously failing burst; it is not a sustained load test.

Existing `smoke-customer-hosted.mjs` also exited 0 with **16 checks**: five assets/legal pages matched exact content hashes; disabled session/callback endpoints returned the expected 108-byte application 503; mutation/synthetic-role/bearer attempts returned 403; closed MCP routes returned 401. Security headers, no cookies, no redirects, and operator/contact text passed. The intentional login-disabled 503 is distinct from the former 33-byte gateway failure.

These use fictional header/token values and disabled configuration. They do not test a real linked customer, genuinely expired provider credentials, successful logout, or AWS-signed service credentials. Those tests remain mandatory once real LWA is configured.

## Browser verification

The public [Flo staging page](https://i4ceh4qpdg.execute-api.us-west-2.amazonaws.com/) completed initialization on initial load and after Control+R. Accessibility state and visual inspection showed:

> Login with Amazon is not configured. No customer access is enabled.

The button remains disabled. The page no longer remained at “Checking sign-in availability…” in these checks. The ownership warning, preview disclaimer, privacy link, and terms link rendered. No consent box or login action was submitted.

## Observability and limitations

Used bounded read-only log and metric calls for 01:52:00–01:53:46 UTC. All **19 scripted request IDs and statuses** matched access logs; missing IDs: zero. Log payload fields were requestId/status/latency; timestamp was added from event metadata by the verification script. The function log read returned 75 events, 24 REPORT entries and zero checked error markers (ERROR, timeout, import failure).

The first metric read returned only minute **01:52 UTC**: Throttles Sum **0**, Errors Sum **0**, ConcurrentExecutions Maximum **3**. Missing later points were not treated as zero. A later bounded refresh returned both **01:52 and 01:53 UTC**, covering the scripted and browser checks: Throttles Sum **0** and Errors Sum **0** in both minutes; concurrency maxima **3** and **2**, respectively. See the [settled metric evidence](customer-concurrency-metrics-2026-09-05.json). These observations are limited to the tested window, not a production-capacity or all-traffic guarantee.

Targeted ESLint passed for both hosted smoke scripts. No application source changed in this deployment; no new full application build/test run is claimed. Earlier package and Docker results remain historical evidence, not reruns.

## Next gate

Configure the real LWA security profile for the hosted origin and exact `/auth/lwa/callback` URL, provision its secret privately, and establish independently verified test-identity-to-customer links before enabling login. Test real hosted success and all rejected-access cases. Website login remains separate from official Alexa+ linking and testing. Submission and video publication remain paused.
