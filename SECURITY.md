# Security Policy

## Supported versions

Security fixes are applied to the current `main` branch until a formal release policy is published.

## Reporting

Do not open a public issue for a suspected vulnerability. Contact the maintainers privately and include affected components, reproduction steps, impact, and any proposed mitigation. Replace this paragraph with a verified security contact before public release.

## Security properties

- Authentication is abstracted from authorization; production adapters must verify identities before constructing an actor.
- RBAC is enforced in the service layer and again before transactional execution.
- Purchases and scheduling mutations require an unexpired, single-use confirmation token bound to the actor and operation.
- Purchase idempotency keys prevent duplicate orders.
- Customer approval is server state, never a model assertion.
- Money, compatibility, inventory, and schedule checks use deterministic code.
- Streamable HTTP deployments validate `Host` and `Origin`, authenticate remote callers, rate-limit requests, and avoid customer PII in logs.
- Secrets are supplied through environment variables or AWS Secrets Manager.

## Threat assumptions

The included demo services use synthetic data and demo authentication. They are not production identity providers. Do not expose the demo configuration to the public internet without replacing demo auth, configuring TLS, restricting origins, and provisioning managed persistence.
