# Security design and threat assumptions

## Trust boundaries

- Alexa+/simulator input is untrusted.
- MCP arguments are untrusted and validated with Zod.
- Provider responses are untrusted and parsed into domain schemas.
- Conversational memory is a convenience signal, never authorization.
- Supplier, customer, and schedule state can change between planning and confirmation.

## Implemented controls

- Role/permission checks before protected orchestrator operations.
- Server-side customer-approval checks.
- Actor-bound, five-minute, single-use confirmation tokens.
- State revalidation at confirmation time.
- Idempotency keys for purchase execution.
- Exact schedule conflict checking.
- Structured errors without unnecessary customer PII.
- Structured audit events for purchase and schedule mutations.
- Local Host and Origin validation on the MCP endpoint.
- Environment-based service configuration and no committed credentials.

## Local-demo limitations

Local mode uses demo identities selected by request headers, in-memory state, and plain HTTP on loopback. Those are deliberate demo constraints, not production controls. A public deployment must:

1. terminate TLS;
2. validate a signed identity token and derive roles server-side;
3. persist approvals, confirmation nonces, idempotency keys, audits, and schedules;
4. use a strict host/origin allowlist;
5. enforce rate limits per authenticated principal;
6. use Secrets Manager for credentials;
7. redact provider and customer data from telemetry; and
8. alert on repeated authorization, confirmation, or order failures.

## Transaction invariant

A purchase/schedule operation may execute only when the same authenticated actor confirms a current prepared action, the linked estimate remains approved, the token is unexpired and unused, the supplier offer remains valid, and the schedule remains available. The confirmation tool checks these facts again. A model response cannot bypass this invariant.

