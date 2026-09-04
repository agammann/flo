# AWS deployment workstream

The AWS target architecture is documented in `docs/architecture/aws.md`. An account deployment is intentionally not fabricated in this milestone: there is no checked-in placeholder command that reports success without provisioning resources.

The next implementation should add:

1. an AgentCore Runtime-compatible entrypoint for the orchestrator;
2. an AgentCore Memory implementation of `MemoryStore`;
3. DynamoDB repositories for business state, confirmation records, and idempotency keys;
4. identity-derived actors and roles;
5. CloudWatch metrics/logging with customer-data redaction;
6. Secrets Manager references; and
7. account/region-specific deployment infrastructure with a readback smoke test.

Only after those resources are implemented and verified should the root expose a `deploy:aws` command.

