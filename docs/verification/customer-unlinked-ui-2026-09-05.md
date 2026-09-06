# Signed-in, unlinked customer UI correction

## Scope and release status

Local source and customer staging bundle updated; **not deployed**. No AWS resource, credential, customer mapping, repair record, submission, or video was changed. The previously deployed asset hashes and deployment reports remain historical evidence for that earlier package.

The reported post-consent behavior displayed both the sign-in form and the shop-link-required error. The existing session endpoint checks the provider identity before returning `403 CUSTOMER_NOT_LINKED`. The browser previously treated that response like a reason to display the sign-in form again.

## Corrected behavior

Only the exact `403 CUSTOMER_NOT_LINKED` response now shows:

> **You’re signed in. Shop verification is required.**
> Your Amazon account is connected, but your shop has not linked it to a customer record. No repair information is available yet.

- Hide the sign-in form and repair command panel; clear previously displayed private repair fields.
- Keep Sign out available, including retry after a failed server logout.
- Do not initiate another OAuth flow automatically or create a customer link.
- Return to the sign-in form on session expiry or confirmed logout.
- Do not label unrelated errors as a successfully authenticated, unlinked account.
- Preserve the existing epoch check so a late session response cannot undo logout.

Server-side authentication, ownership enforcement, and service/user authorization are unchanged. Hiding repair controls is presentation, not the security boundary.

## Verification

- `node scripts/compile-workspaces.mjs`: passed all 13 workspace configurations.
- `node scripts/compile-workspaces.mjs --noEmit`: passed.
- `node node_modules/eslint/bin/eslint.js . --max-warnings=0`: passed.
- `node scripts/run-tests.mjs`: **101 tests, 17 suites, all passed**. Existing customer ownership, unlinked/expired/revoked identity, service credential rejection, and logout tests remain included.
- `node --test tests/dist/integration/customer-signin-ui.test.js`: seven new tests passed. These execute the actual public browser script in a Node VM with a lightweight DOM and controlled HTTP responses; they are not a real Amazon browser test or a visual layout test.
- `node scripts/build-customer-staging.mjs`: rebuilt the Lambda bundle and public assets without deployment.
- Local Docker `node:22.23.2-bookworm-slim`, read-only bundle/script mounts, `--network none`: `smoke-customer-lwa-config.mjs` passed. Synthetic configuration initialized; absent website session and separate Alexa route denied. No provider or AWS calls, and no real credentials supplied.

## Next deployment gate

Review the new packaged artifact before updating staging. After deployment, verify the hosted authenticated-unlinked screen, retained Sign out control, denied repair request, and real logout. Do not treat this local correction as hosted verification, completed customer enrollment, or official Alexa+ account linking.
