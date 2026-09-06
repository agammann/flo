# Focused security remediation verification — September 5, 2026

Scope: four findings from the completed source review, Docker/configuration discrepancies, and prerequisite checks for the separately approved customer staging environment. This is a working-tree verification, not a published commit, fresh CI result, or production certification. Prior uncommitted work was preserved. Devpost submission and video publication remain paused.

## Four application findings: fixed and verified locally

| Original failure | Enforcement boundary and regression evidence | Legitimate control |
| --- | --- | --- |
| One unauthenticated source could fill all 1,000 pending OAuth login slots | `CustomerWebsiteAuth.begin` bounds starts and outstanding state per verified client source; both admission and pending maps are bounded and expire. Repeated/replacement starts count toward the quota. HTTP tests reject rotating untrusted forwarded headers before any provider call. | A different source can sign in. Superseded state is denied, the current browser state succeeds, and admission recovers after expiry. |
| TLS proxy topology would collapse every customer into one new quota | The final read-only candidate review caught this problem. The loopback TLS entrypoint now requires explicit trusted-proxy addresses. Only those peers can supply the strictly validated single client-IP header, which the proxy must overwrite. | Behind the same trusted proxy, the attacking source is limited while another client still receives a login start. Missing or malformed proxy identity fails closed. |
| Order status could disclose another job's purchase order | `getOrderStatus` checks `requireWorkOrderRead` against the fetched order's work-order ID before returning it. Both order ID and idempotency-key paths are tested. | Assigned technicians can read their own orders; managers can read all authorized orders. |
| A malformed HTTP Host could crash the MCP request listener | Host/Origin validation precedes routing; routing uses a fixed trusted URL base, catches parse failures, and rejects non-origin-form targets. Raw HTTP tests send malformed Host values and alternative absolute/network-path targets. | The same listener continues serving health checks and real MCP negotiation/tool calls after rejected requests. Origin-less server-to-server clients still work. |
| Hostile browser requests could reach privileged simulator commands or the signed narrator path | Middleware precedes all routes and JSON parsing. Exact local authority and full Origin checks plus a signed browser-session cookie and bound CSRF token gate every mutation. Hostile hosts cannot obtain the bootstrap token. | Shop and customer browser callers use the bootstrap helper. Tests verify valid sessions, expiry, cross-session token mismatch, duplicated cookies, reset, new conversation and commands. Denials occur before the downstream counter changes and return explicit no-change UI messages. |

The proxy review was one independent read-only candidate-review cycle. Its confirmed concern was corrected and retested by the parent. No full rescan or workbench finding closure was performed during remediation.

## Configuration and documentation

- Compose explicitly enables `FLO_DEMO_MODE=true` for **both** MCP and simulator under the production-mode image. Tests inspect each service block independently.
- `.dockerignore` excludes `.env.*`, private configuration directories and customer-link JSON files.
- Existing `ALLOWED_ORIGIN_HOSTNAMES` documentation matches the MCP runtime key; its regression test passes.
- Simulator remains a loopback synthetic demo. Host/Origin/CSRF controls do not authenticate arbitrary remote users, and disabling demo tools does not establish production authentication.
- `SECURITY.md` contains the exact owner-approved correction: the handler conditionally decrements allowance, but the role's UpdateItem permission does not independently prevent initialization/refill by different or compromised code. Matching AWS documentation was corrected.
- The narrator template now declares a retained log group with seven-day retention. Existing installations must first import an already-created group; no live import, deletion, retention change or narrator redeployment was performed.
- Video reconciliation distinguishes implemented mocked-provider LWA tests from unverified live sign-in and official Alexa linking. Existing MP4/captions were preserved; no video was published.

## Ordered verification

1. Build and typecheck: `node scripts/compile-workspaces.mjs` and `node scripts/compile-workspaces.mjs --noEmit` — passed across all 13 projects.
2. Security triggers and alternate malicious inputs: included in `node scripts/run-tests.mjs` — **72 tests / 13 suites passed**, zero failures, skips or cancellations. Synthetic provider contracts, not live Amazon authentication.
3. Legitimate workflow and regression checks: the complete suite includes deterministic fitment/pricing, approval/SKU binding, incompatible estimate rejection, cross-job approval isolation, cancelled-order retry and missing trim.
4. `node node_modules/eslint/bin/eslint.js . --max-warnings=0` — passed. `git -c core.autocrlf=false diff --check` — passed.
5. Started `node scripts/local-smoke-fixture.mjs` on isolated loopback port 4550, with ephemeral mock-service ports, `NODE_ENV=production`, explicit demo opt-in and AWS disabled. Ran `FLO_SMOKE_URL=http://127.0.0.1:4550 node scripts/docker-smoke.mjs` (set the variable using the shell's syntax) — full HTTP/MCP workflow passed, including the corrected $561.33 gross-profit branch, approval, resumed context, confirmed purchase/Bay 2 scheduling, customer review and rejected duplicate.
6. Real browser check on that disposable fixture: the consumer estimate button rendered the approved $561.33 estimate through the new browser boundary; the shop new-conversation button succeeded. These are custom-browser checks, not Amazon's official simulator/device tests.

## Deployment evidence boundaries

- Docker CLI and the standard Docker Desktop executable were unavailable on this host. **Docker Compose launch remains unverified.** The existing CI Docker job must run against a future pushed commit before claiming a container launch.
- AWS checks were read-only: the existing narrator stack showed `UPDATE_COMPLETE`; Route 53 domain and hosted-zone listings both returned empty arrays. This does not rule out domains held outside this account.
- No customer staging URL, live LWA credential, privacy inbox, public privacy notice, new AWS application resource or production mapping was created by the application fixes.
- Local cfn-lint installation was approved but failed on Windows temporary-directory permissions. The separately approved isolated CloudShell installation succeeded with cfn-lint 1.56.0. The upload menu did not open reliably, so the public immutable source commit plus the exact ten-line retention patch was staged in the temporary validation directory. Its SHA-256 matched the local file: `50d078065a8206933e45ae49e36e4a32d102443d1cfb6d38cf92c37d064fca69`. `cfn-lint --format json --regions us-west-2 -t template.yaml` returned `[]` and exit code 0. This validates schema, not policy compliance or a live resource import/change set.
- The owner approved the AWS-generated website URL with a separate free Proton privacy inbox instead of purchasing a domain. Signup was prepared, but no inbox creation, username availability or mail delivery has been verified. The privacy notice retains its unresolved contact rather than publishing a guessed address.
- Separately approved CloudFormation Guard 3.2.1 checks completed against the unchanged template and 39 selected AWS registry rule files: 8 failed rules, 16 passed, 12 not applicable, exit 19. These include workload-specific policy decisions, not eight confirmed exploits. See [the policy-check report](cloudformation-policy-check-2026-09-05.md) for exact provenance, affected properties, proposed changes and deployment gates. No new AWS resources were created to satisfy those policies.
- Single-process website auth and business state are not a durable multi-instance staging implementation. The planned Lambda boundary and shared session/revocation store still require implementation and tests. Website sign-in is not official Alexa+ account linking.
