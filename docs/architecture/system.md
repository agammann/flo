# System architecture

## Boundaries

Flo separates natural-language planning from operational truth:

- The conversational adapter interprets intent and produces concise summaries.
- `FloOrchestrator` selects and sequences deterministic capabilities.
- MCP handlers only validate transport input, invoke the orchestrator, and serialize structured results.
- Domain engines own compatibility, ranking, pricing, approval, schedule, and confirmation rules.
- Adapter interfaces isolate provider-specific APIs.
- Services own persisted business state and enforce conflicts/idempotency.

The local implementation uses HTTP mock services so the demo exercises real network and serialization boundaries. It does not place provider data directly in a browser or pretend that a UI fixture is a supplier response.

## Main workflow sequence

```mermaid
sequenceDiagram
  actor T as Technician
  participant A as Alexa+ / simulator
  participant M as Flo MCP
  participant O as Orchestrator
  participant S as Shop APIs
  participant P as Supplier APIs
  participant C as Customer API

  T->>A: Open work order 1842
  A->>M: get_work_order
  M->>O: getWorkOrder(actor, 1842)
  O->>S: GET work order + asset
  S-->>O: structured job
  O-->>A: job summary + visual data
  T->>A: Alternator failed; find options
  A->>M: record_diagnostic + compare_parts
  O->>P: supplier searches in parallel
  P-->>O: price, stock, delivery, warranty
  O-->>A: compatible ranked options
  T->>A: Add it and request approval
  A->>M: create_estimate + request_customer_approval
  O->>S: deterministic estimate
  O->>C: pending approval
  C-->>O: approval id
  T->>A: Order and schedule
  A->>M: prepare_purchase_and_schedule
  O->>S: recheck approval + schedule
  O-->>A: confirmation token + exact summary
  T->>A: Confirm
  A->>M: confirm_transaction
  O->>S: revalidate current state
  O->>P: idempotent place order
  O->>S: reserve bay + update job + audit
  O-->>A: confirmed purchase and schedule
```

## Failure behavior

Errors are machine-readable and include a stable code, safe message, retryability, recovery choices, and optional details. Expected failures include authorization denial, missing or ambiguous job context, unknown compatibility, unavailable delivery, stale approval, occupied bay, expired/used confirmation, supplier failure, and timeout. One supplier failure does not require discarding valid responses from other suppliers.

## Industry neutrality

`Asset.type`, work orders, estimates, schedule slots, approvals, parts, suppliers, and audit records are generic domain objects. The automotive-specific seed and fitment engine are one adapter/rule set. A future HVAC implementation can substitute equipment identifiers and compatible component rules without changing confirmation, estimate, approval, memory, or MCP transport behavior.

