# Alexa+ requirements review and implementation tracker

Reviewed September 5, 2026. This is an engineering tracker, not an Amazon certification decision. All distinct pages directly supplied in the documentation list were read. Index pages were reviewed as indexes; this does not claim a recursive review of every category SPI, design chapter, or payment reference linked beneath them. Authentication and account-linking child pages were additionally read because they directly affect Flo.

## Two independent acceptance gates

The [hackathon requirements](https://amazonappdev2026.devpost.com/) accept a demonstrated self-hosted MCP server using 2025-11-25+ and Streamable HTTP, or a working custom simulation. They also require source, a public English video under three minutes, feedback, and entry details. That path does not grant Alexa+ certification. AWS Builder evidence and Open Source evidence are separate from official add-on validation.

The [Alexa+ policy requirements](https://developer.amazon.com/docs/alexaplus/add-ons/policy-requirements.html) exclude exclusively internal/B2B add-ons. Flo's original shop workflow alone is therefore not the consumer add-on to submit. A real vehicle-owner experience is being developed alongside it; changing a tagline alone would not resolve this gap. Amazon still determines eligibility and certification.

## Implemented first increment, local only

| Interface | Scope | Boundary |
| --- | --- | --- |
| `/` | Vehicle-owner preview: repair list, status, customer estimate review | Synthetic-data acknowledgement, typed commands, optional read-aloud, start over, explicit unsupported-action responses |
| `/customer/mcp` | `list_my_repairs`, `get_my_repair`, `get_my_estimate` | Three read-only tools. Fixed synthetic owner in demo mode; 401 when demo mode is disabled. No OAuth claim. |
| `/shop` and `/mcp` | Existing shop demonstration | Existing internal workflow preserved; not the customer add-on surface and not safe for public multi-user deployment |

Customer ownership is checked before returning a work order or reading its estimate. The estimate must be linked to that exact work order. Explicit response projections omit VINs, contact information, diagnostic/shop notes, internal identifiers, supplier cost, and shop margin. Caller-provided customer/role headers cannot switch the demo owner. Tool arguments do not accept identity. These protections are local application boundaries, **not verified account linking**.

Source: `packages/agent/src/customer-experience.ts`, `services/flo-mcp/src/customer-tools.ts`, `apps/alexa-simulator/src/customer-router.ts`. Regression tests live alongside the domain projection and in `tests/integration/mcp-transport.test.ts`.

The customer preview performs no approval, booking, cancellation, payment, or purchase. It calls actual MCP tools backed by the simulated Shop API, not frontend fixtures. It does not call Bedrock. Its command router is deterministic and intentionally limited; Alexa's real language understanding is not simulated as a general-purpose model.

## Get Started: reviewed sources and consequences

| Source | Application to Flo |
| --- | --- |
| [Developer Docs Home](https://developer.amazon.com/docs/alexaplus/add-ons/home.html) | Documentation access does not establish partner/toolkit access. Keep official execution unclaimed until account setup succeeds. |
| [Alexa+ Add-ons](https://developer.amazon.com/docs/alexaplus/add-ons/overview.html) | Alexa orchestrates the experience. Flo supplies structured capabilities rather than requiring Alexa to run the local scripted conversation. |
| [Choose the integration approach](https://developer.amazon.com/docs/alexaplus/add-ons/choose-the-proper-alexaplus-integration-approach.html) | MCP Toolkit is the current prototype route for bespoke repair information. Evaluate Category Action Local Booking before adding consumer appointment booking; existing MCP code alone is not sufficient reason to select a production route. Target sub-500-ms query round trips; measure under representative load. |
| [Development stages](https://developer.amazon.com/docs/alexaplus/add-ons/alexa-plus-add-on-development-stages.html) | Local build, official test, certification, and live publication are distinct evidence stages. Do not equate deployment with approval. |
| [Development environment](https://developer.amazon.com/docs/alexaplus/add-ons/set-up-your-development-environment.html) | Official tooling requires Node 24+ and authorized package access. The local app's Node 22+ requirement is separate. Use a supported tooling environment and least-privilege credentials; do not create administrator keys merely to follow a sample. |
| [Amazon support](https://developer.amazon.com/docs/alexaplus/add-ons/get-support-from-amazon.html) | Resolve partner access, integration category, and conflicting examples with Amazon support or the assigned Solutions Architect. |

## MCP Toolkit: reviewed sources and consequences

| Source | Application to Flo |
| --- | --- |
| [Overview](https://developer.amazon.com/docs/alexaplus/add-ons/mcp-toolkit-overview.html) | Use Streamable HTTP and the declared MCP revision; existing transport tests assert 2025-11-25. Keep Alexa-generated speech distinct from local narration. |
| [Create an MCP Add-on](https://developer.amazon.com/docs/alexaplus/add-ons/mcp-toolkit-quickstart.html) | Remote HTTPS, manifest, invocation phrases, required image sizes, privacy/terms URLs and official deployment remain pending. Data-only tools are possible; a custom browser page is not an MCP App resource. Redeploy when tool definitions change. |
| [Design guide](https://developer.amazon.com/docs/alexaplus/add-ons/mcp-addon-design-guide.html) | Voice should carry essential outcomes; visuals carry detail. Use legible, low-density screens. Do not promise Alexa will recite the simulator's exact script. |
| [Client and app lifecycle](https://developer.amazon.com/docs/alexaplus/add-ons/mcp-toolkit-client-lifecycle.html) | Do not infer a durable customer identity from an MCP connection or require explicit app sessions. Support data-only fallback before packaging hosted UI. |
| [Local Inspector](https://developer.amazon.com/docs/alexaplus/add-ons/mcp-toolkit-local-inspector.html) | The official inspector supports local tool/debug checks and optional visual inspection. It has not been run here; ordinary MCP-client tests are not that tool or certification. |
| [Test MCP add-ons](https://developer.amazon.com/docs/alexaplus/add-ons/mcp-toolkit-test-add-ons.html) | Test tools independently, including invalid input and repeat calls, then exercise the official simulator/device path. Current automated tests cover only local services and transport. |
| [Certify and publish](https://developer.amazon.com/docs/alexaplus/add-ons/mcp-toolkit-certify.html) | Complete metadata and official tests before submission. Certification and publication are separate; tool contract changes require lifecycle review/redeployment. |
| [Supported capabilities](https://developer.amazon.com/docs/alexaplus/add-ons/mcp-toolkit-supported-capabilities.html) | This is an index. Authentication and account-linking children were read, not assumed from the heading. |
| [Authentication](https://developer.amazon.com/docs/alexaplus/add-ons/mcp-toolkit-authentication.html) | Separate service credentials from linked-user identity. Service tokens must not unlock owner records. The demo's 401 boundary is not an OAuth implementation. |
| [Account linking](https://developer.amazon.com/docs/alexaplus/add-ons/mcp-toolkit-account-linking.html) | Implement static client registration, PKCE S256, resource binding and protected-resource metadata with a verified provider. This Alexa client documents restrictions including no DCR/CIMD/OIDC discovery and no `WWW-Authenticate` on its 401 response. Do not reuse the AWS narrator's SigV4 identity as customer OAuth. |

## Category SDK, testing and certification

| Source | Application to Flo |
| --- | --- |
| [Category SDK overview](https://developer.amazon.com/docs/alexaplus/add-ons/overview-category-sdk.html) | Category contracts are predefined; Local Booking may overlap a future owner booking feature. The current Category MCP route targets ride booking, not generic workshop operations. |
| User's “Build a Category Action Add-on” and “Build a Category MCP Add-on” links | Both supplied URLs point to the Toolkit overview's empty `#` fragment, not separate instructions. Navigation resolves to [Category Action creation](https://developer.amazon.com/docs/alexaplus/add-ons/category-sdk-create-category-addon.html) and [Category MCP creation](https://developer.amazon.com/docs/alexaplus/add-ons/category-sdk-create-mcp-addon.html). The former was inspected for route/setup; the latter was read. Full category-specific SPI implementation remains out of scope until route selection. |
| [Web Simulator](https://developer.amazon.com/docs/alexaplus/add-ons/test-with-web-simulator.html) | Amazon's official simulator tests a deployed add-on with isolation/global modes and surface options. Flo's browser preview does not replace this evidence. |
| [Payments](https://developer.amazon.com/docs/alexaplus/add-ons/payments-overview.html) | This page routes to payment/checkout guides. No payments are implemented. Before adding any, read the applicable detailed references and validate the payment category with Amazon. |
| [Certification guidelines](https://developer.amazon.com/docs/alexaplus/add-ons/certification-guidelines.html) | Maintain functional and policy evidence together. A passing local test suite is not a certification result. |
| [Functional requirements](https://developer.amazon.com/docs/alexaplus/add-ons/functional-requirements.html) | Validate explicit sorting, ambiguity, readable errors, context reset/expiry and consistent voice/screen output. For transactional features, cover the complete lifecycle and duplicate handling. Customer preview currently declines all writes rather than claiming incomplete lifecycle support. |
| [Policy requirements](https://developer.amazon.com/docs/alexaplus/add-ons/policy-requirements.html) | Consumer purpose, privacy/terms, consent, data minimization, accurate metadata and rights-cleared assets are required gates. Flo is not directed at children. A demo acknowledgement is not a published privacy policy or production consent flow. |

## Reference pages

| Source | Application to Flo |
| --- | --- |
| [Alexa AI CLI](https://developer.amazon.com/docs/alexaplus/add-ons/alexa-ai-cli-reference.html) | Generate the manifest using the authorized installed CLI. Specify stage, poll deployment status, preserve test evidence and inspect actual `--help` before using flags from examples. No official CLI deployment or submission was performed. |
| [Add-on API](https://developer.amazon.com/docs/alexaplus/add-ons/alexa-plus-addon-api-reference.html) | Lifecycle APIs use Login with Amazon bearer authorization, not the narrator's AWS signing scheme. Async acceptance is not completion; poll the relevant terminal result. No undocumented endpoints were implemented. |
| [Metrics catalog](https://developer.amazon.com/docs/alexaplus/add-ons/addon-metrics-catalog.html) | Discover available metrics before querying. Official engagement/account-linking/task metrics cannot be claimed from local tool logs. |
| [POI catalog schema](https://developer.amazon.com/docs/alexaplus/add-ons/poi-data-schema.html) | Relevant if Flo becomes a shop discovery/catalog integration. Use stable identifiers and accurate real provider data. Do not upload fictional shops, fabricated ratings, addresses, or opening hours. Not needed for this fixed-owner local preview. |
| [Category troubleshooting](https://developer.amazon.com/docs/alexaplus/add-ons/troubleshooting-the-category-sdk.html) | Separate allowlist/role, package-token expiry and deployment problems. Do not change global npm/git credentials or broaden AWS permissions without a specific need and authorization. |

## Next release gates, in order

Identity decision: the entrant selected **Login with Amazon** for customer sign-in on September 5. This authorizes the integration direction, not credential creation or cloud provisioning. The original preview still uses a synthetic principal. A separate customer-only website now implements server-side LWA code exchange, PKCE, audience/user-ID verification, opaque sessions and an operator-maintained customer-link adapter, with simulated-provider tests. Real Amazon sign-in, a production enrollment workflow and official Alexa MCP service/user authorization remain unverified or incomplete. See [the identity setup and boundaries](architecture/customer-identity.md). Do not request Amazon secrets in chat or auto-link a repair by email or a caller-supplied record number.

1. Review the vehicle-owner scope with Amazon, including whether future appointment booking belongs on Category Action Local Booking. Consumer utility is implemented only as a read-only prototype, not a complete certification-ready product.
2. Prepare Login with Amazon sign-in, then provision only specifically approved registration/tooling. Implement verified OAuth scopes, issuer/audience/resource checks, trusted customer mapping, service-token isolation, unlink/revocation behavior and tests. Validate the full Alexa MCP authorization contract separately from a successful website login. Keep demo headers and fixed principals off the production customer route.
3. Replace in-memory business state with durable tenant-scoped stores, confirmation/idempotency persistence and controlled retention/deletion. Never expose mock APIs or the shop demo as a public backend.
4. Add consumer approvals/booking only with explicit scope, immutable price approval, cancellation/modification/status coverage and deterministic conflict checks. No payment claim until separately implemented and validated.
5. Complete latency/load/failure, multi-user, ambiguity, context expiry/reset and voice/visual accessibility tests. The shop comparison now separates balanced ranking from explicit gross-part-profit ranking. The local phrase “best margin” states that it uses dollars, not percentage; official Alexa should clarify an ambiguous measure. Do not describe the balanced recommendation as the highest profit.
6. Generate official manifest/assets and publish reviewed privacy/terms URLs; package MCP App resources only if custom visuals are included. Test in the official Local Inspector, then Amazon's web simulator and applicable devices. Preserve reports and actual lifecycle status.
7. Reconcile repository, video, captions and Devpost story to the same tested feature set. Obtain separate authorization for public pushes/deployment, certification submission and final video publication as appropriate. Record final submitted/live states instead of inferring them from saved drafts.

## Documentation ambiguities to confirm

These are observed documentation differences, not reproduced runtime defects:

- The Toolkit overview names 2025-11-25 while lifecycle/inspector examples show older protocol revisions. Flo's transport test remains anchored to the named requirement.
- The setup guide's OS list and Inspector's Windows examples need a supported-environment clarification for this Windows host.
- Authentication scope examples and account-linking CLI flags differ between linked guides. Use the supported installed CLI contract and confirm service/user scope behavior with Amazon; do not guess an authorization policy.

Track concrete observations in [the friction log](hackathon/friction-log.md). This review did not modify AWS resources, publish a repository update, change YouTube visibility or submit an add-on.
