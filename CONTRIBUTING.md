# Contributing to Flo

Flo welcomes focused contributions that preserve its safety model and industry-neutral core.

1. Open an issue describing the use case or defect.
2. Create a focused branch and add tests with the change.
3. Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build`.
4. Do not commit credentials, customer data, or supplier secrets.
5. Explain any new adapter's authorization, rate-limit, idempotency, and failure behavior.

Transactional tools must enforce approval and confirmation in deterministic server code. A prompt-only safety check is not accepted.
