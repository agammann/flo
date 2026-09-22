# Flo release recheck — September 21, 2026 (Pacific)

## Scope and conclusion

This is a bounded contest-readiness recheck, not a penetration test, a complete
security audit, an AWS certification or an Alexa+ certification decision.
No application failure was found in the executed tests. Stale release-status
documentation was found and corrected. A read-only AWS configuration and metrics
review also completed. Customer sign-in was not repeated in this session.

The public main commit checked was
`6c336924add011848762c7d7c16970d344d82c0b`. Its four newer commits change only
README/submission/feedback documentation relative to local release `c21a294`;
application source, lockfile, tests and deployment templates are identical.
The checkout was fast-forwarded without discarding the pre-existing local
`.devpost-hackathon-state.json` modification. The corrections accompanying this
report are documentation only and were not deployed to AWS or saved to Devpost.

## Freshly executed checks

| Check | Result |
| --- | --- |
| Workspace build (13 TypeScript configurations) | Passed |
| Typecheck and ESLint | Passed |
| Customer staging and three enrollment bundles | Built successfully |
| Application/integration suite | 151 total: 148 passed, 3 platform skips, 0 failures |
| Node script regression suite on Windows | 94 total: 88 passed, 6 POSIX skips, 0 failures |
| Python packaging/designation/verifier suite on Windows | 34 total: 30 passed, 4 platform skips, 0 failures |
| Linux Docker private-handoff/approval tests | 12 passed, no skips or failures |
| Fresh Docker image with frozen lockfile | Built successfully |
| Six-service Docker HTTP/MCP workflow | Passed |
| Isolated DynamoDB Local contracts | Passed |
| Network-disabled request/redemption/approval bundle smoke checks | Passed |
| Production dependency advisory audit | 0 advisories reported across 124 dependencies |

The workflow exercised real local MCP tool execution, protocol 2025-11-25,
gross-dollar-profit ranking, estimate/approval, a new conversation with resumed
context, confirmed purchasing/scheduling, owner-only review and duplicate
confirmation rejection. Regression tests include incompatible-part rejection,
approval/SKU binding, cross-job isolation, cancelled-order retry and missing trim.

Database-emulator checks exercised encrypted persistent sessions, atomic callback
and redemption races, approval snapshot binding, A/B isolation, expiry, logout
and audit rollback. These use synthetic identities and are not live AWS IAM tests.

The six-service audit ran on a separate internal Docker network without AWS
credentials. Its Windows-host published-port check returned connection refused;
the complete HTTP smoke passed when run inside its simulator container. Thus
this run establishes container startup and inter-service execution, not browser
reachability of that temporary host port. The ordinary published-port Compose
workflow also passed the public Linux CI run below. Existing local demo containers
and their data were left untouched; a read-only request to their normal
`http://127.0.0.1:4200/api/health` returned 200, MCP connected, protocol 2025-11-25,
28 tools and Bedrock narration disabled. The temporary audit containers/networks were
removed after testing; the rebuildable audit image remains local.

Python was not on PATH; the suite ran using the bundled workspace Python runtime.
Platform skips are not counted as passes.

## Current external read-backs

- [GitHub](https://github.com/agammann/flo) is public and GitHub detects MIT.
- [CI run 35490467082](https://github.com/agammann/flo/actions/runs/35490467082)
  is successful for the exact public commit: both `verify` and `docker-demo`.
  This is a September 20 CI run inspected now, not a newly dispatched run.
- [Devpost](https://devpost.com/software/flo-yozfdv) remains published and its
  event entry returns `submitted_at: 2026-09-08T04:21:41.880-04:00`.
- The saved submitted payload covers all 26 current form field IDs, including
  both mini-challenge selections and the open-source contribution URL. Individual
  answers were compared with the saved payload, not freshly read from the form.
- [YouTube replacement](https://www.youtube.com/watch?v=5BxqSCW_XNc) renders
  and plays in the signed-in browser, with visible English subtitles and 2:54
  duration. A fresh complete audio/transcript or signed-out review was not run.
- [AWS customer site](https://i4ceh4qpdg.execute-api.us-west-2.amazonaws.com/):
  home, privacy and terms returned 200, with no-store, CSP and HSTS headers.
  Privacy names Alexander Ammann and the approved monitored contact address.
  An anonymous `/auth/session` returned 401 `SIGN_IN_REQUIRED`, without repair data.

## Fresh read-only AWS review

The local `flo-staging-operator` CLI profile was expired. The owner then signed in
to the AWS console as `arn:aws:iam::114599789754:user/flo/flo-staging-operator`.
CloudShell denied `cloudshell:CreateEnvironment`; the CloudFormation console also
denied `cloudformation:ListStacks` because no identity policy allowed those actions.
The console's empty stack list therefore is not evidence that stacks are absent.
The connected AWS Core session subsequently allowed the following bounded review
in `us-west-2`, without broadening the operator's permissions. The connector
identified as the account root identity; it was used only for reads. Future
routine reviews should use a scoped, least-privilege identity.

| Configuration | Observed result |
| --- | --- |
| Five Flo stacks | Narrator, artifacts, customer staging, enrollment state and enrollment all `CREATE_COMPLETE` or `UPDATE_COMPLETE` |
| Seven Flo log groups | Seven-day retention; narrator function and access logs have explicit KMS configuration |
| Five Lambda reserved-concurrency limits | Customer HTTP: 3; narrator: 2; each enrollment function: 1 |
| Seven DynamoDB tables | `ACTIVE`, on-demand billing, enabled encryption and deletion protection |
| Seven-day point-in-time recovery | Enabled for enrollment audit, customer links, customer repairs and narration allowance |
| Authentication and one-time enrollment tables | PITR disabled as previously approved; TTL enabled for auth state, requests, approvals and audit |
| Customer API stage | Rate 2 requests/second, burst 5; minimal request ID/status/latency access logs |
| Narrator API stage | Rate 1 request/second, burst 2; minimal access logs; `POST /narrate` uses `AWS_IAM` |
| Lifetime model-attempt allowance | Strongly consistent read: 98 remaining, 2 used; no refill or model call |

The customer API uses application-level Login with Amazon/session authorization,
not API Gateway IAM authorization. Its `NONE` gateway route authorization is not
evidence that private customer records are public; the anonymous session check
above returned 401. This review did not repeat linked-customer authorization.

CloudWatch's selected seven-day window was September 15 at 05:30 UTC through
September 22 at 05:30 UTC. It returned 25 customer API requests, including 15
4xx responses and zero 5xx responses. The customer Lambda reported 25 invocations,
zero errors and zero throttles. The 4xx aggregate does not establish the cause of
each rejection. No payloads or individual customer log events were read.
The enrollment functions and narrator returned no invocation datapoints in this
window; absence of traffic is not a fresh successful functional test.

No IAM grants, credentials, stacks, model allowances, customer links or records
were changed. No Bedrock invocation was performed. Model allowance, concurrency
and API throttles are not an account-wide dollar spending cap. This metadata
review did not compare deployed code hashes or review every effective IAM policy.
Real Amazon sign-in, linked-customer access and logout were not rerun; their
September 8 evidence remains historical.

## Contest rules and production standards

Live Devpost MCP rules, submission requirements, dates and project data were
retrieved September 21 Pacific (September 22 UTC). The September 16 rules update
retains the simulated Alexa+ route and requires functional repository source.
The deadline is October 23, 2026 at noon Pacific. Public MIT source, setup/run
instructions, runtime MCP code and the 2:54 video provide the relevant artifacts.
AWS Builder and Open Source have documented integration/contribution evidence;
final eligibility and judging belong to the organizers.

Sources: [official event rules](https://amazonappdev2026.devpost.com/rules),
[requirements](https://amazonappdev2026.devpost.com/).

Hackathon acceptance does not establish Alexa+ certification. Current
[certification guidelines](https://developer.amazon.com/docs/alexaplus/add-ons/certification-guidelines.html)
and [policy requirements](https://developer.amazon.com/docs/alexaplus/add-ons/policy-requirements.html)
still require the applicable functional, consent, privacy and end-consumer
experience. Official OAuth/account linking, Amazon host/device validation,
manifest/MCP App delivery and certification remain incomplete. The internal shop
workflow alone is not an eligible consumer add-on. AgentCore is not deployed.

## Corrections in this documentation change

- Replaced the README's obsolete assertion that the video predates the ranking fix.
- Reconciled current submission/readiness/video references with the verified
  September 8 event submission timestamp.
- Clearly marked earlier readiness checkpoints as historical.
- Preserved the distinction between hosted customer fixtures and the local shop
  workflow; did not imply that the full operational demo runs on AWS.
- Kept fresh checks separate from older cloud, authentication and video evidence.
- Added a judge-facing quick-start table distinguishing the runnable Docker shop
  workflow, local owner preview, hosted customer website and recorded walkthrough.

The bounded contest-readiness recheck is complete. No application or infrastructure
change was justified by these checks. A production Alexa+ release still requires
the separate official integration/certification work; website login is not Alexa+
account linking. This conclusion is not a guarantee of eligibility, prizes,
security or uninterrupted operation.
