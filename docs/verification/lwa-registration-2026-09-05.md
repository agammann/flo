# Login with Amazon registration — September 5, 2026 (Pacific)

Subsequent checkpoint: the owner requested storage of the supplied credential, and Secrets Manager metadata confirms an AWSCURRENT version. See [secret provisioning evidence](lwa-secret-provisioning-2026-09-05.md). The private handoff below is historical; the deployed website still has LWA disabled and no hosted sign-in is verified.

## Completed: real profile and exact callback; private secret transfer pending

The owner requested real LWA configuration for the deployed customer staging origin, private secret provisioning, independently verified test-customer mapping and successful/rejected hosted tests. The account's LWA console initially showed no profiles. Created one dedicated profile and observed **Login with Amazon successfully enabled for Security Profile**. This enables the Amazon profile, not the deployed Flo website's `LwaEnabled` parameter.

Saved values read back from Amazon:

| Field | Value |
| --- | --- |
| Name | Flo |
| Description | Read-only repair-status and estimate preview. Amazon sign-in identifies the user; a separately verified shop association controls access to fictional test repair records. |
| Security profile ID | `amzn1.application.d288d070c7bc4602ab440ccfdc320fb7` |
| Public client ID | `LWA_CLIENT_ID_REDACTED_FROM_PUBLIC_EVIDENCE` |
| Consent privacy notice | `https://i4ceh4qpdg.execute-api.us-west-2.amazonaws.com/privacy` |
| Allowed origin | `https://i4ceh4qpdg.execute-api.us-west-2.amazonaws.com` |
| Allowed return URL | `https://i4ceh4qpdg.execute-api.us-west-2.amazonaws.com/auth/lwa/callback` |

No client secret was revealed, copied into chat, or committed. No extra scopes or app platforms were configured. The website implementation requests only `profile:user_id` and exchanges codes server-side with state/PKCE. [Amazon registration guide](https://developer.amazon.com/docs/login-with-amazon/register-web.html), [authorization-code guide](https://developer.amazon.com/docs/login-with-amazon/authorization-code-grant.html).

## Private provisioning handoff

The us-west-2 Secrets Manager list contained only the existing state-encryption secret, not an LWA secret. Opened **Store a new secret**, selected **Other type of secret**, and entered the nonsecret key name `clientSecret`. The value field is blank and no AWS secret has been stored. Default encryption selection is `aws/secretsmanager`; no new customer-managed key is needed.

The owner must copy the client secret directly from this Flo security profile into the AWS value field, then finish the wizard using name **`flo/customer-staging/lwa`**. Keep replication, custom resource policies and automatic rotation off for this initial credential; a random AWS rotation cannot rotate Amazon's upstream client secret. Do not paste the value into chat or expose it in a screenshot. After storing, close/hide the revealed Amazon secret and leave AWS on the secret metadata or list page before asking the agent to resume.

The planned new secret adds the published Secrets Manager storage rate of $0.40 per secret-month, plus API usage, subject to applicable pricing/credits; no paid resource was created by merely opening the form. [AWS pricing](https://aws.amazon.com/secrets-manager/pricing/).

Verify only secret metadata/version existence. Use the existing CloudFormation dynamic-reference path for `clientSecret`; never fetch plaintext into tool output. Prepare and review the exact LWA-enablement change set before execution. Do not alter customer limits or narrator settings as part of that update.

## Identity is not ownership

No customer link or repair projection was written. The live website still has login disabled. The current implementation allows a valid Amazon identity to establish a website session, but protected routes require a separately maintained `(clientId, Amazon user ID)` link. The runtime can read, but cannot write, the trusted link table.

Real mapping remains a separate gate: obtain the subject through an authenticated, server-verified enrollment process, have an authorized operator independently verify the assignment, and record verifier/time/evidence. The existing schema's evidence fields record a decision; they do not themselves perform verification. Do not derive a link from email, repair number, VIN, caller-typed Amazon ID or the first successful login. No production enrollment workflow has been claimed. Use fictional repairs and explicitly designated testers only.

Suggested hosted test sequence after private provisioning and reviewed enablement:

1. Real Amazon sign-in with an unlinked test identity: identity may succeed, repair access must fail.
2. Establish a reviewed test association through verified enrollment, not by bypassing the unlinked failure.
3. Confirm only that customer's fictional repairs/estimate are visible; another customer's and unknown repair requests must not disclose data.
4. Verify expired/revoked credentials, logout, unlinking, and attempts to substitute service credentials.
5. Keep official Alexa+ linking, service/user authorization and certification tests separate.

## Local verification this turn

`node scripts/compile-workspaces.mjs` passed all 13 build configurations. `node scripts/run-tests.mjs` passed **93 tests across 16 suites**, zero failed/skipped. These include mocked provider and SDK contracts, local HTTP/MCP integration and ownership/transaction regressions. They do **not** prove a live provider exchange, hosted authenticated DynamoDB operations or actual linked-customer access.

No application source or deployment changed in this registration turn. Secret provisioning, hosted sign-in, trusted enrollment, official Alexa+ checks and release work remain incomplete. Devpost submission and video publication remain paused.
