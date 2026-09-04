# Flo demo script

Target runtime: 2:50. Record at 1080p. Keep the MCP inspector visible only when it supports the story; use production mode for the final transaction.

## 0:00–0:15 — Problem

**Narration:** “Technicians shouldn’t have to stop working to search across multiple business systems. Flo turns Alexa+ into a hands-free operating layer for service teams.”

Show the technician beside a repair bay, then the Flo idle surface.

## 0:15–0:30 — Retrieve the job

**Technician:** “Alexa, open work order 1842.”

**Expected voice response:** “Work order 1842 is a 2019 Ford F-150 with a battery warning light and intermittent no-start. It’s assigned to you and is in diagnosis.”

Show the Work Order Card and briefly reveal the `get_work_order` invocation.

## 0:30–1:00 — Diagnose and search

**Technician:** “The alternator failed. Find compatible replacements under $300 that can arrive tomorrow.”

Show `record_diagnostic`, `get_asset`, compatibility checks, parallel supplier searches, the `AWS · amazon_bedrock_narration` trace, and the comparison panel.

**Expected voice response:** “I found four compatible supplier offers. ProMotion Supply’s premium alternator is the best balance at $219 shop cost, next-day delivery, and a three-year warranty.”

## 1:00–1:25 — Compare margin

**Technician:** “Which gives us the best margin without using the cheapest part?”

Highlight Supplier B. The visual panel shows part number ALT-7842, $219 cost, $295.65 customer price, three-year warranty, next-day delivery, and recommendation rationale.

## 1:25–1:45 — Estimate and approval

**Technician:** “Add it to the estimate and request approval.”

Show the $459.03 estimate and approval status `PENDING`. In the admin/demo control, simulate the customer approval and show `APPROVED`.

## 1:45–2:05 — Persistent context

Start a fresh conversational session without resetting service state or job memory.

**Technician:** “Alexa, what happened with the Ford?”

**Expected voice response:** “Customer approval is complete for work order 1842. The Supplier B alternator is selected and no order has been placed yet.”

## 2:05–2:35 — Safe transaction

**Technician:** “Order the alternator and schedule the truck in Bay 2 tomorrow morning.”

Show the approval, supplier offer, and Bay 2 rechecks.

**Expected voice response:** “Ready to order one ALT-7842 from Supplier B for $219 and schedule work order 1842 in Bay 2 tomorrow from 8 to 10. No action has been executed. Say confirm to proceed.”

**Technician:** “Confirm.”

Show the placed order, scheduled job, and two audit events.

## 2:35–2:52 — Architecture

Show one concise diagram: Alexa+ → MCP → orchestrator → deterministic engines and adapters → service systems. Highlight the verified Lambda → Amazon Bedrock narration path separately; label AgentCore and DynamoDB as roadmap items.

**Narration:** “Every business fact comes from a tool. Compatibility and money are deterministic. Bedrock adds a concise narration lead, never operational truth. Approval and confirmation are enforced on the server.”

## 2:52–2:58 — Close

**Narration:** “Flo turns Alexa+ into a hands-free operating layer for service teams.”

End on the repository URL and MIT license.

## Recording checklist

- Reset immediately before recording with `pnpm demo:reset`.
- Verify work order 1842, three suppliers, approval reset, no prior order, Bay 2 free, and tomorrow’s generated dates.
- Verify the public repository and license.
- Verify video audio and public playback in a signed-out browser.
- Keep the final video under three minutes.
- Do not display environment files, tokens, customer contact fields, or private AWS identifiers.
