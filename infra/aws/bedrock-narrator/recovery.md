# Allowance recovery: fail closed, never replenish from a backup

PITR is a recovery aid, not authorization for more model attempts. Seven-day PITR and retained KMS keys are configured in source; live deployment and recovery are separate approved operations.

1. Obtain explicit incident/recovery approval before pausing narrator invocation. Preserve deterministic simulator fallback. Record the current consistent-read allowance and any authoritative record of attempts after the chosen restore point. Do not print credentials or customer data.
2. Restore only to a separately named, isolated table for inspection. Never delete the protected original table to reuse its name. Keep the runtime policy and `ALLOWANCE_TABLE` pointed at the original; the existing role has no restore, table-creation, table-deletion or PutItem permission.
3. Never reconnect a restored snapshot to the narrator without reconciliation. Its historical `remaining` value may be greater than the current allowance. If the original table can be repaired, prefer that over migration.
4. Without complete, trustworthy evidence of all subsequent attempts, the only safe recovered allowance is **remaining=0, used=100**. Uncertain/failed model calls count as consumed. Even when evidence exists, do not increase remaining beyond the smallest verified post-backup balance. New model capacity requires a separate explicit allowance approval, not this recovery workflow.
5. Review the replacement table identity, policy/key changes and allowance state together. Preserve read evidence, reconcile while invocation is paused, then obtain explicit cutover approval. There is intentionally no automatic restore-to-runtime script.
6. Test rejected/exhausted calls first and verify no Bedrock invocation occurs. Only then test an approved remaining allowance. Check the authoritative table and CloudWatch outcomes before resuming traffic.

Retain every key needed to decrypt surviving tables and backups. Automatic key rotation is not key deletion. Disabling or scheduling deletion of a key can make retained backups unusable. PITR, keys, retained logs and rejected requests can incur charges; this is not an account-wide dollar cap.
