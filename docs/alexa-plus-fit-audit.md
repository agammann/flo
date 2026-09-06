# Alexa+ fit audit

Audit date: 2026-09-04

This document compares the working local Flo implementation with current official Alexa+ add-on guidance. It separates verified compatibility from work that still requires Amazon partner access and an official Alexa+ environment.

## Verdict

Flo is a strong conceptual and technical fit for the Alexa+ MCP Toolkit path: it is a task-completing, conversational service with a real MCP server, structured tools, persistent job context, and server-enforced transactional safeguards. It is not yet an Alexa+ add-on. The custom browser simulator demonstrates the workflow but does not prove Alexa+ invocation, Alexa-hosted rendering, certification, or device support.

Amazon currently describes Alexa+ developer access as available to select partners. Until access and an add-on deployment are verified, Flo documentation must continue to say “designed for Alexa+” or “Alexa+ integration target,” not “available on Alexa+.”

## Hackathon eligibility verdict

The hackathon rules are intentionally broader than production Alexa+ add-on certification. They accept either a self-hosted MCP server using spec `2025-11-25` or later over Streamable HTTP, an Agent Skill, or a clearly demonstrated simulated Alexa+ experience. Flo has locally verified evidence for the first requirement and includes the source for a custom simulation. It is therefore technically aligned with the Alexa+ track even though it is not yet a certified or public Alexa+ add-on.

The general Alexa developer page describes Alexa as a cloud voice service and points developers to Skills Kit, device, and enterprise paths. That page supports Flo’s hands-free premise, but it does not replace the hackathon’s Alexa+ MCP requirements or the newer Alexa+ add-on documentation.

Release evidence now includes the public MIT-licensed repository at <https://github.com/agammann/flo>, complete product feedback, and a 2:41 English YouTube demo at <https://youtu.be/ZjROvjL2smo>. The video is playable by link but remains unlisted, so it is not yet final public-video evidence. Flo also has a documented, live-invocation-tested Lambda-to-Amazon-Bedrock integration for the AWS Builder mini challenge. Final eligibility still depends on uploading the reviewed captions, explicitly publishing the video, saving the selected tracks and Open Source fields, and completing the Devpost submission without adding unverified claims.

## Verified alignment

| Alexa+ expectation | Flo evidence | Status |
| --- | --- | --- |
| Existing MCP servers should use the MCP Toolkit when they need control over tools, data, and rendering | Flo exposes a standalone MCP server rather than hiding tool execution in its UI | Aligned |
| MCP `2025-11-25` and Streamable HTTP | The transport integration test asserts the exact negotiated version and calls a live tool | Verified locally |
| Add-ons complete tasks within the conversation | The primary workflow reads a job, records diagnosis, compares suppliers, builds an estimate, requests approval, and prepares/executes a confirmed transaction | Verified locally |
| Structured data should drive Alexa’s answer and the screen | Tools return `structuredContent`; local spoken summaries and visual cards are now derived from the same tool result | Verified locally |
| Voice-only responses must remain intelligible without formatting artifacts | MCP text fallbacks are concise natural language instead of serialized JSON | Fixed locally |
| Visuals should be legible at arm’s length and adapt to different use modes | The simulator now uses large typography, low-density cards, 48-pixel controls, light/dark themes, responsive layouts, and a customer-controlled focus mode | Fixed locally |
| Comparison results should use a short horizontal carousel, with the best result first | Compatible parts render as three horizontally scrollable cards and the server-ranked recommendation leads | Fixed locally |
| Sensitive actions need clear confirmation and state agreement | Preparation returns an exact summary and short-lived token; confirmation rechecks approval and bay availability; UI says when nothing has executed | Verified locally |
| Voice and touch offer the same transaction decision | The confirmation surface exposes explicit 48-pixel Confirm and Cancel controls that run the same command path as voice | Fixed locally |
| Multi-system execution handles partial failure safely | If ordering succeeds but scheduling fails, Flo automatically cancels the order; if cancellation cannot be verified, it returns a non-retryable partial-failure error with recovery instructions | Fixed and tested locally |
| Non-demo tools should be purposeful and avoid demo controls | Approval simulation, deterministic demo time, and reset tools are omitted when `NODE_ENV=production` unless explicitly opted in with `FLO_DEMO_MODE=true`. Docker is a local-only demo and opts in for both MCP and simulator. Hiding tools is not production authentication. | Verified by configuration tests |

## Corrections made in this audit

1. Replaced hard-coded Supplier B, price, customer price, order, Bay 2, and job-status narration with wording derived from live structured tool results.
2. Added deterministic customer price and gross part margin fields to ranked supplier results so the visual comparison does not recalculate money in the browser.
3. Replaced raw JSON MCP text content with concise voice-safe text while preserving the full structured result.
4. Reduced the production tool surface by excluding three simulator-only controls.
5. Redesigned the simulator around one conversation panel and one primary visual result instead of a dense three-column dashboard.
6. Added a carousel for part alternatives, customer-controlled focus mode, adaptive breakpoints, light/dark themes, visible focus styles, reduced-motion support, and 48-pixel controls.
7. Added explicit visual Confirm and Cancel actions for the prepared purchase/schedule transaction.
8. Added compensating cancellation and a regression test for the order-placed/schedule-failed race.

## Remaining work before claiming Alexa+ integration

1. Obtain or confirm Alexa+ select-partner developer access.
2. Package the visual surfaces as actual MCP App resources. Declare minimal `_meta.ui.csp`, use the MCP Apps postMessage bridge, and adapt to the Alexa-provided host context rather than browser-width guesses.
3. Create and deploy the add-on through the supported Alexa+ skill or CLI path, then record its identifier and environment.
4. Replace the generic MCP output envelope schemas with intent-specific output schemas for the externally exposed tool set, keeping responses synchronized with those schemas.
5. Test voice-only, inline, and full-screen behavior on every available official target surface. Confirm that voice and screen agree exactly on prices, dates, status, and pending versus completed actions.
6. Run Amazon’s functional and customer-experience certification checks, including vague utterances, mid-flow changes, out-of-scope requests, denied approval, stale supplier stock, schedule conflicts, and duplicate confirmation.
7. Verify authenticated production identity, durable state, HTTPS, secrets, observability redaction, and remote failure recovery before public deployment.

## Official references

- [Alexa+ developer overview](https://developer.amazon.com/alexaplus)
- [General Alexa developer overview](https://developer.amazon.com/en-US/alexa)
- [Amazon Developer Hackathon overview](https://amazonappdev2026.devpost.com/)
- [Amazon Developer Hackathon official rules](https://amazonappdev2026.devpost.com/rules)
- [Alexa+ MCP Toolkit overview](https://developer.amazon.com/docs/alexaplus/add-ons/mcp-toolkit-overview.html)
- [MCP add-on design guide](https://developer.amazon.com/docs/alexaplus/add-ons/mcp-addon-design-guide.html)
- [Conversation surface](https://developer.amazon.com/docs/alexaplus/add-ons/mcp-addon-conversation-surface.html)
- [Display modes](https://developer.amazon.com/docs/alexaplus/add-ons/mcp-addon-display-modes.html)
- [Layout and rendering](https://developer.amazon.com/docs/alexaplus/add-ons/mcp-addon-layout-and-rendering.html)
- [Visual foundations](https://developer.amazon.com/docs/alexaplus/add-ons/mcp-addon-visual-foundations.html)
- [Components and patterns](https://developer.amazon.com/docs/alexaplus/add-ons/mcp-addon-components-and-patterns.html)
- [Accessibility](https://developer.amazon.com/docs/alexaplus/add-ons/mcp-addon-accessibility.html)
- [Tool, schema, and data design](https://developer.amazon.com/docs/alexaplus/add-ons/mcp-addon-tools-schema-data-design.html)
- [Customer-experience testing](https://developer.amazon.com/docs/alexaplus/add-ons/mcp-addon-test-addon-cx.html)
