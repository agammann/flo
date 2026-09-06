# Proposed customer hosting and LWA registration

Historical proposal. Customer staging is now deployed and its browser checks passed; a real Flo LWA security profile and exact callback have been registered. Private secret transfer and hosted sign-in remain pending. See [current LWA registration evidence](../verification/lwa-registration-2026-09-05.md) and [deployment verification](../verification/customer-concurrency-deployment-2026-09-05.md). Statements below about resources not yet created describe the original planning checkpoint.

Prepared September 5, 2026. **The owner approved a separate usage-billed staging setup, an AWS-generated website URL, and a separate free privacy inbox. Implementation and deployment gates remain incomplete: no new application resources, customer URL, Security Profile or credentials have been created.**

## Approved no-domain-purchase path

- Use the AWS-generated HTTPS origin for the customer staging site. No domain purchase is authorized.
- The owner selected `xyes47314@gmail.com` as the privacy contact, superseding the attempted Proton signup. No new inbox or custom-domain email is required. On September 5 the owner confirmed **Alexander Ammann** as the operator and confirmed that this inbox is monitored and receives mail. The draft records that owner confirmation; no independent delivery test was performed.
- Validation tooling in an isolated CloudShell temporary directory is separately approved and does not authorize changes to the existing narrator. Review the exact application change set before execution. Devpost submission and video publication remain paused.

## Located accounts

- The signed-in Amazon Developer LWA console says Login with Amazon has not been set up on this account. The Security Profile creation form is available and requires Name, Description and Consent Privacy Notice URL. Logo is optional.
- The signed-in AWS CloudFormation console in `us-west-2` shows the existing `flo-bedrock-narrator` stack in account ending `9754`. This is the narrator, not the customer website or OAuth callback. This check was limited to the region's visible CloudFormation stacks, not an account-wide resource inventory.

## Proposed new deployment, separate from the narrator

- A new `flo-customer-web` CloudFormation stack in `us-west-2`.
- API Gateway HTTP API supplies a stable AWS-managed HTTPS origin; no purchased domain is required. Use the default stage so the website's root-relative paths and exact `/auth/lwa/callback` path remain consistent.
- Lambda serves the isolated customer website and server-side sign-in handlers. Before deployment, adapt and test the existing Node HTTP implementation for the Lambda event boundary; do not simply upload a long-running local server and claim it works.
- DynamoDB stores expiring login state and sessions with explicit authorization-time expiry, atomic single-use login-state consumption and revocation. Trusted customer links remain operator-controlled and never writable by the public website role. Implement/test this persistence adapter before enabling login; in-memory sessions are not a reliable multi-instance deployment.
- Secrets Manager holds the LWA client secret through an approved private provisioning path. Use secret references/runtime injection; do not print, paste into chat, commit or expose values in stack outputs.
- A narrowly scoped execution role, finite seven-day log retention, API throttling and bounded function concurrency. No Bedrock calls from this customer deployment. No public mock/shop ports or staff role-header endpoints.

This uses usage-billed AWS services and can incur charges. Request limits, concurrency limits and retention are not an account-wide hard dollar cap. Review a traffic-specific cost estimate and the exact change set before resource creation. Existing Flo narrator resources will not be modified.

## LWA registration after URLs are live and reviewed

Proposed profile name: **Flo**.

Proposed description: **Read-only repair-status and estimate preview. Amazon sign-in identifies the user; a separately verified shop association controls access to fictional test repair records.**

Consent Privacy Notice URL: the deployed, owner-approved `/privacy` page. Operator identity and inbox receipt/monitoring are owner-confirmed. Actual hosting, persistence and retention statements still need deployment verification, so the current draft must not be published as-is.

Allowed Return URL: the exact generated origin plus `/auth/lwa/callback`; do not substitute the Amazon documentation URL, the Bedrock `/narrate` endpoint or a static callback placeholder.

Website OAuth scope: `profile:user_id`. Do not add email/address/payment scopes or grant AWS privileges to the customer.

Creating the profile establishes new application credentials. Obtain action-time confirmation before saving. If a secret must be entered into a private configuration UI, the owner completes that sensitive entry without exposing it in screenshots or tool output. The client ID may be recorded in nonsecret configuration once verified.

## Evidence required after creation

1. Observe stack completion and exact HTTPS origin; test public landing/privacy pages and closed unauthenticated customer access.
2. Verify LWA profile saved/enabled, public consent privacy URL, and exact return URL without revealing the secret.
3. Test real successful Amazon sign-in, state/PKCE/callback behavior, unlinked/wrong-customer denial, expiry, logout/revocation and service-token rejection against the deployed website.
4. Keep official Alexa+ linking/testing separate. Do not configure the website-only MCP bearer scheme as Alexa user/service OAuth.
5. Record all source/deployment/test evidence; update the privacy notice to the actual persistence/logging behavior. Video replacement and final publication remain separately gated.
