# Release source checkpoint — September 6, 2026

This checkpoint verifies the source accompanying the deployed request-only KMS
correction. It does not certify Alexa+, enable private enrollment, or establish
customer repair ownership.

## Verified locally

- Full workspace build (13 configurations), customer/enrollment bundles,
  TypeScript checks and ESLint: passed.
- Windows application suite: 148 passed, three platform skips (151 total).
- Node script regression suite: 56 passed.
- Offline Python regression suite in the isolated validator container: 25 passed.
- Docker Compose configuration and actual six-service startup: passed.
- HTTP demo smoke against those containers: real MCP, gross-profit ranking,
  approval, persisted conversation context, confirmed purchase/scheduling,
  owner-only review and duplicate rejection passed.
- Separate enrollment bundles under Docker with no network: passed fail-closed
  request/redemption and private-approval checks.
- Isolated DynamoDB Local contracts: passed encrypted persistence, callback race,
  session isolation, trusted-link transactions, tampered/forged approval rejection,
  eight-way redemption race, replay prevention, audit rollback, expiry and logout.

The emulator uses synthetic identities. It is not evidence of AWS IAM or hosted
approval/redemption success. Docker test networking is internal; no AWS credentials
are supplied to these tests. The demo's shop state remains mock/in-memory.

## Release boundaries

CI now discovers every Python and Node script regression test instead of running
only a subset. A fresh remote CI result must be verified after the source push.
The hosted request-only result is recorded separately in
[deployment evidence](request-dynamodb-kms-deployment-2026-09-06.md).
Private approval/redemption remain disabled. Real independently authorized customer
mapping, applicable official Alexa+ checks, replacement-video review, complete
Devpost materials and final publication/submission approval remain outstanding.

No passwords, OAuth codes, customer identity hashes, pairing codes or invitations
are included in this checkpoint.
