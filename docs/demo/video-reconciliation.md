# Replacement-video reconciliation

Status: historical recording plan, superseded by the
[rendered replacement cut](replacement-cut-2026-09-08.md), September 8, 2026 (UTC).
The owner approved the new cut; public publication remains a separate gate.
The plan below is retained for provenance, not as current video-production status.

The hosted site has verified real Login with Amazon sign-in/sign-out, a
signed-in/unlinked state, independently approved fictional-customer pairing, and
owned-repair isolation. The [September 8 hosted test](../verification/customer-repair-fixture-live-2026-09-08.md)
shows customer A can read repair 1842 but not customer B's 2842 or unknown 9999.
Both hosted repair fixtures have no estimate and no scheduled dates. They are
independent DynamoDB test records, NOT synchronized copies of the local shop demo.
The private operator's temporary enrollment permission was removed after pairing;
filming must not imply that an unsigned-in visitor can approve a customer link.
The original video remains unsuitable for the corrected release. Older evidence
below is historical and must not be presented as the current source's test result.

The source checkpoint `aabafec16037032ddfbd19ccf43df780514b60c4` has a fresh
[successful CI run](https://github.com/agammann/flo/actions/runs/34056513856),
including a real Docker Compose launch, MCP demo and isolated DynamoDB contracts.
The final recording must identify its own final tested source, not reuse this
checkpoint as evidence for later changes.

The local source is `outputs/Flo-demo.mp4` in the parent workspace. Its segment narration is in `work/flo-video/segments.json`; source frames and audio are alongside it. The repository's `flo-demo.en.vtt` belongs to that existing 2:41 cut. Preserve that caption file and original MP4 until the replacement is rendered, reviewed and explicitly approved. Do not change captions to say something different from the old spoken audio or screen.

The current uploaded video is [ZjROvjL2smo](https://youtu.be/ZjROvjL2smo). Its publication state was not rechecked during this edit-plan pass. No Studio upload, caption replacement, thumbnail replacement or visibility change was performed.

## Required edits

| Existing segment / caption time | Mismatch | Replacement evidence |
| --- | --- | --- |
| Opening and idle, 0:00–0:23 | Only the shop interface is introduced | Introduce the consumer preview and label the shop interface as a separate simulation. No official Alexa/device claim. |
| Parts and margin, 0:34–1:04 | Balanced recommendation is not the highest gross part profit; the original capture explicitly asks for best margin | Show both rankings. Balanced: $219 cost and $76.65 gross part profit. Dollar-profit ranking: $289 cost and $101.15 gross part profit. State that this is dollars, not percentage. |
| Estimate, 1:05–1:16 | $459.03 reflects the $219 balanced part, not the corrected highest-profit selection | If retaining the best-profit command, record the resulting $561.33 estimate: part $390.15, labor $126, fees $12, tax $33.18. Do not mix these branches. |
| Approval and memory, 1:17–1:38 | No vehicle-owner preview is shown | Show owner estimate review and the shop's separate simulated-approval control. The owner preview cannot approve anything. |
| Confirmation and completion, 1:39–2:07 | Original selected part, order and estimate differ from the corrected branch | Re-record the exact new transaction summary, no mutation before confirmation, successful result and duplicate rejection. Use the live generated date/time, not an old fixed date. |
| Architecture, 2:07–2:28 | Narration labels all DynamoDB use as future | DynamoDB backs deployed auth/session, trusted linking, enrollment, customer projections and narrator allowance. Local shop business state remains in-memory and is not synchronized with hosted projections. AgentCore remains incomplete. A successful historical Bedrock call is not a fresh live verification. |
| Closing card, 2:28–2:41 | The source contact sheet still displays 14 passing tests | Re-render with the result from the final recorded commit, or omit a hardcoded count. Local test counts change during hardening; use the dated verification report for the exact tested source, not evidence for a future cut. |
| New sign-in scene | Old footage does not show the now-verified hosted identity and ownership boundary | Record actual LWA sign-in, owned 1842, denied 2842, and sign-out using the approved fictional A account. Do not show identity tokens or pairing codes. Website login is not official Alexa+ account linking. |

## Replacement recording sequence

Target approximately 2:50, with timing finalized against the actual narration and footage:

1. **0:00–0:12:** Hands-free repair-workflow problem; introduce a custom Alexa-style shop simulation plus a separate hosted customer site. Do not label the hosted LWA flow as simulated.
2. **0:12–0:32:** Actual hosted Login with Amazon, owned repair 1842 and denied 2842. Use approved fictional A; omit provider credentials, personal identity, and pairing codes. State that shop verification, not sign-in alone, grants repair access. The hosted estimate is not ready: never show the local estimate as hosted data.
3. **0:32–1:02:** Clearly switch to the separate local shop simulation, diagnose and search through actual MCP; distinguish balanced and gross-profit rankings.
4. **1:02–1:25:** Create the matching local estimate, review it in the local owner preview, and explicitly simulate approval from the shop demo. Keep a visible local/simulated-data label.
5. **1:25–1:40:** Start a new conversation and retrieve the stored job status. State that current business state is in-memory unless durable persistence has actually been added and tested.
6. **1:40–2:12:** Prepare, confirm and verify order/scheduling; show a rejected repeat.
7. **2:12–2:40:** Evidence-based architecture: real MCP tool calls to mock shop services, deterministic engines, deployed Lambda/Bedrock narrator, DynamoDB auth/link/projections and allowance. Label any historical AWS call by date. Official Alexa+ account linking, Inspector, simulator/device testing and certification are not completed; AgentCore is not deployed.
8. **2:40–2:50:** MIT repository, consumer benefit and concise release-status statement.

## Acceptance checks before release

- Run build, typecheck, lint, unit/integration tests and a complete demo smoke against the exact recorded source.
- Choose one pricing branch and keep footage, spoken audio, captions and description consistent throughout.
- Capture real executed tool outcomes. Never generate screens that falsely imply a successful Amazon login, AWS invocation, Alexa deployment or purchase.
- Do not imply hosted/customer and local/shop data are synchronized. Hosted fixtures have no estimate; all pricing, approval, purchase and scheduling demonstrations belong to the separate local mock-services workflow.
- Do not require a new billable AWS call just for footage. Historical AWS evidence can be shown only with its date and status labeled accurately; the local customer preview does not call Bedrock.
- Create a new caption track from the replacement's actual narration and timestamps, then review timing and spelling by watching/listening to the rendered cut. Estimated script timing is not reviewed caption timing.
- Verify final runtime, readable UI, audible narration and accurate on-screen boundaries. Recheck the thumbnail/title/description against the new consumer scope.
- Keep “not made for kids” as instructed. Obtain separate final publication confirmation, then verify the resulting public watch page and Devpost linkage. A new video upload has a different watch URL; update links only after the actual replacement exists.

## Historical test evidence

The September 5 rerun passed build, no-emit typecheck, lint and all **45 tests in 10 suites**, with no failed or skipped tests. These tests cover the current local implementation, not Login with Amazon or official Alexa tooling. The original media and captions remain unchanged. This document completes the discrepancy inventory, not video production or account linking.

For the latest hosted boundaries, use the dated September 8 report linked above
and the final recorded commit's CI run. Do not reuse this historical test count.
