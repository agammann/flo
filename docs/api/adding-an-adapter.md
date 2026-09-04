# Adding a service adapter

1. Choose the smallest interface in `packages/adapters` that represents the provider.
2. Implement transport, authentication, timeout, retry, and provider error translation in that package or a dedicated integration package.
3. Parse every provider response into Flo Zod schemas. Do not pass provider-shaped `unknown` data into the orchestrator.
4. Preserve integer cents, ISO timestamps, compatibility status, inventory quantities, and stable provider IDs.
5. Declare provider capabilities and unavailable operations honestly.
6. Add contract tests for success, malformed output, timeout, partial failure, and idempotent retry.
7. Inject the adapter through `createHttpAdapters` or an environment-specific composition root.

A supplier adapter must support search, order placement, order status, cancellation when the provider supports it, and demo reset only for simulated implementations. Purchasing must accept an idempotency key. Provider catalog documentation alone is not evidence that production API access exists.

