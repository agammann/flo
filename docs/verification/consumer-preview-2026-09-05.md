# Local consumer-preview verification — September 5, 2026

Scope: the uncommitted local certification-readiness increment on top of the existing Flo repository. This is not evidence of a GitHub Actions run, AWS deployment, official Alexa test, or certification result.

This records the earlier 45-test synthetic preview snapshot. The later, separate Login with Amazon website increment is recorded in [customer sign-in verification](customer-signin-2026-09-05.md); it does not turn this simulator into a real authenticated session.

## Quality gates

| Check | Result |
| --- | --- |
| `node scripts/compile-workspaces.mjs` | Passed, all workspace packages and tests |
| `node scripts/compile-workspaces.mjs --noEmit` | Passed |
| `node node_modules/eslint/bin/eslint.js . --max-warnings=0` | Passed, no warnings |
| `node scripts/run-tests.mjs` | 45 tests, 10 suites, 45 passed, no failures/skips |
| `node scripts/docker-smoke.mjs` against isolated local HTTP services | Passed; **not a Docker/Compose launch** |

The smoke test used a disposable, newly seeded single-process development instance: simulator port 4300, MCP 4310, mock APIs 4311–4314, all loopback. `NODE_ENV=production` and `FLO_DEMO_MODE=true` enabled explicitly synthetic demo behavior. `BEDROCK_NARRATOR_URL` was empty. AWS was not invoked. The earlier instance on port 4200 was left untouched.

New coverage checks owner-only lists and reads, other-owner/unknown repair error parity, ownership before estimate reads, mismatched asset ownership, cross-job estimate rejection, exact customer totals/private-field removal, absent estimate handling, empty identity rejection, isolated customer tool registration, ignored identity-header overrides, strict argument rejection, closed non-demo customer access, preview consent/input/action limits, real preview-to-MCP execution and deterministic gross-profit ranking.

## Browser checks

- A repair query before acknowledging the synthetic-data notice was declined.
- After acknowledgement, the owner saw only fictional repair 1842.
- Before the shop generated an estimate, the preview stated that no estimate was ready.
- The complete shop smoke workflow searched, compared, estimated, simulated approval, resumed context, prepared/confirmed purchase and scheduling, and rejected duplicate confirmation.
- The owner preview then displayed an approved estimate of **$561.33**: $390.15 part, $126.00 labor, $12.00 fees, $33.18 tax, no discount. Subtotal already includes fees. It did not disclose supplier cost or margin.
- The customer attempt to approve work was explicitly declined; no customer mutation tool ran.
- Start over cleared the browser conversation/details. A subsequent status read still returned the scheduled repair.
- Schedule text showed readable UTC start/end times, and the visual fields represented the same times. Loading messages disappeared when requests completed.
- Desktop layout was visually inspected for conversation and estimate readability. No official Alexa surface, physical device, mobile viewport, microphone recognition or audio playback test is claimed.

## Ranking correction

Balanced ranking still recommends the seeded $219 option with $76.65 gross part profit. Explicit `gross_part_margin` ranking selects the $289 option with $101.15 gross part profit, within the same price/delivery constraints. This measure is dollars, not profit percentage. The local command makes that interpretation explicit. The old video predates this correction and the consumer preview; update/re-record the affected material before final release.

## Remaining boundary

The customer identity is a fixed synthetic principal, not OAuth. Production customer access returns 401 until genuine linking is configured. The shop endpoint still uses demo identity assumptions and must not be exposed publicly. All business state is in-memory. No account credentials were provisioned, AWS resources changed, commits pushed, Devpost forms submitted, or YouTube visibility changed. See [the certification tracker](../alexa-plus-certification-plan.md) for the remaining requirements and reviewed source inventory.
