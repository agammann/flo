# Customer sign-in verification — September 5, 2026

**Historical checkpoint:** the counts and single-process limitations below describe the earlier implementation. The subsequent durable customer implementation and 92-test checkpoint, actual Docker launch, DynamoDB Local test, and packaged Lambda verification are recorded in [CloudShell Docker verification](cloudshell-docker-2026-09-05.md). Real LWA and official Alexa+ verification are still separate incomplete gates.

Scope: local uncommitted Flo code, including the earlier consumer-preview/ranking increment. No GitHub push, AWS deployment, official Alexa+ test or video publication was performed.

## Results

| Check | Observed result |
| --- | --- |
| Workspace build | Passed |
| Workspace typecheck (`--noEmit`) | Passed |
| Full ESLint, zero warnings | Passed |
| Full compiled test suite | **62 tests, 12 suites; 62 passed, no failures or skips** |
| Focused identity and website HTTP/MCP tests | **17 tests passed**, included in the full suite |
| `git diff --check` | Passed |
| Website startup without credentials | Started on loopback 4400, reports sign-in unconfigured |
| Browser negative-path check | Consent checkbox cannot enable login while configuration is absent; no repairs or demo identity shown |
| Browser visual check | Desktop sign-in layout inspected; clearly distinguishes identity from shop ownership |
| Live LWA console check | Signed-in account showed Login with Amazon not set up. Creation form inspected only, not saved. |

The provider tests use **simulated Amazon HTTP responses**, not a real Amazon account. HTTP integration tests run the actual website, MCP client/server and private mock Shop API on ephemeral loopback ports. They establish local behavior, not provider interoperability or production ownership enrollment.

## Verified boundaries

- Authorization-code exchange with browser state and PKCE, fixed official endpoints, minimal user-ID scope, app-audience validation and server-obtained Amazon user ID.
- Exact operator-controlled client/user-to-customer association; no email or caller-supplied customer matching. Invalid, duplicate, missing or wrong-app mapping files fail closed.
- Opaque Secure/HttpOnly website sessions; server-only provider tokens; provider revocation, expiry, unlinked account and logout denial.
- Two-customer isolation for displayed repair numbers and internal work-order IDs; strict argument validation; no identity-header escalation.
- Real read-only MCP invocation and limited customer projections. No customer mutations exposed.
- Raw Amazon tokens, fabricated service tokens and AWS signing credentials do not authenticate the website MCP endpoint.
- Valid website sessions do not unlock `/mcp`, `/alexa/mcp` or `/customer/mcp` on the dedicated website. This is a closed boundary, not an implemented positive official Alexa authorization flow.

## Independent review and timing corrections

A read-only investigator confirmed that the existing repair/estimate ownership projection was sound only after a trusted principal was established. A fresh read-only post-patch reviewer reproduced two additional races using the actual compiled website:

1. A direct website MCP read begun before logout could finish with customer data after logout.
2. A website command begun with mapping A could return A's data after the trusted link was reassigned to customer B; merely checking that the session was still valid was insufficient.

Both paths now verify the **same subject and customer binding** before releasing protected results. The customer MCP tools revalidate before and after the service operation, and the website command handler checks the original binding again before responding. Added regression tests block the shop read while performing logout, expiry, unlink or reassignment, then assert that no prior customer data is emitted. Those tests passed after the fixes. The final corrections were verified by the main agent's tests, not a second independent review cycle.

Local finding outcome: **fixed for the reproduced identity and in-flight binding boundaries**. Overall live sign-in/release outcome: **blocked on configuration and external validation**, not production complete.

## Remaining proof and operational gaps

- No Flo LWA Security Profile/client credentials, approved HTTPS callback, reviewed published privacy notice or real enrollment flow was configured during this work.
- No real successful/denied Amazon browser login, secure-cookie behavior through the final TLS proxy, official Alexa service/user linking, Local Inspector, Amazon Web Simulator or device test is claimed.
- Sessions are single-process in-memory; mock business state is volatile. Real deployment requires private backend authorization, durable business state, a reviewed enrollment/recovery/deletion workflow, rate/load controls, TLS/proxy hardening and approved sign-in assets.
- The existing staff and mock servers remain demonstration-only. The new customer website intentionally does not expose their routes.
- The existing video/captions remain the old cut. Do not rewrite captions to describe scenes that were not recorded; replace and review the actual footage/audio before requesting separate publication approval.
- `SECURITY.md` has not yet been revised for this new entrypoint; its detailed policy update remains a reviewed release task. The identity architecture document records current boundaries and limitations without broadening scanner exclusions.

## Host tooling limitations

The default `node --test` mode was denied child-process spawning on this host. Tests were run using direct compiled imports and the repository's existing in-process test runner; these are actual passing test executions, not skipped tests.

An offline dependency refresh attempted registry supply-chain checks and was stopped when network access was unavailable. Installed modules were not purged. The MCP client already existed in this monorepo at version 2.0.0; the new service dependency and its lockfile importer use that exact existing resolution. Builds/tests pass with installed dependencies, but a fresh dependency installation and fresh GitHub Actions run were not verified in this turn.

See [identity setup and registration evidence](../architecture/customer-identity.md) and [the separate Alexa+ certification tracker](../alexa-plus-certification-plan.md).
