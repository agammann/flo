# Security Policy

## Supported versions

Security fixes are applied to the current `main` branch until a formal release policy is published.

## Reporting

Please do not disclose vulnerability details in a public issue. Use GitHub's **Report a vulnerability** flow at <https://github.com/agammann/flo/security/advisories/new> when that option is available. Include the affected component and version or commit, reproduction steps or a minimal proof of concept, expected impact, and any suggested mitigation.

If private vulnerability reporting is not available, open a minimal issue at <https://github.com/agammann/flo/issues/new> that asks the maintainers to establish a private reporting channel. Do not include exploit details, secrets, customer data, or other sensitive evidence in that public issue. No response-time or disclosure deadline is promised while the project is pre-release; reporters and maintainers should agree on disclosure timing after establishing private contact.

## Security properties

- Authentication is abstracted from authorization; production adapters must verify identities before constructing an actor.
- RBAC is enforced in the service layer and again before transactional execution.
- Purchases and scheduling mutations require an unexpired, single-use, single-flight confirmation token bound to the actor and operation.
- Purchase idempotency keys prevent duplicate orders; cancelled-order keys are retired, and every supplier response is matched to the approved work order, supplier, SKU, quantity, and cost before scheduling.
- Customer approval is server state, never a model assertion, and is bound to an immutable fingerprint of the exact estimate contents.
- Money, compatibility, inventory, and schedule checks use deterministic code.
- Streamable HTTP deployments validate `Host` and `Origin`, authenticate remote callers, rate-limit requests, and avoid customer PII in logs.
- Secrets are supplied through environment variables or AWS Secrets Manager.
- The AWS narrator requires IAM/SigV4, not a public build marker. Its retained DynamoDB allowance reserves every model attempt atomically before execution, never refunds uncertain failures, and fails closed on missing/exhausted/unavailable state. The runtime cannot refill the allowance. This bounds model attempts, not all AWS charges.

## Threat assumptions

The included demo services use synthetic data and demo authentication. They are not production identity providers. Do not expose the demo configuration to the public internet without replacing demo auth, configuring TLS, restricting origins, and provisioning managed persistence.
