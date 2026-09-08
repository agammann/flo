# Fictional customer-A activation deployment — 2026-09-08

Status: **DEPLOYED. Configuration and credential-free rejection checks passed. Customer linking test remains incomplete.**

Executed only the explicitly approved change set `flo-fictional-a-activation-review-20260908t052523z` in us-west-2.
CloudFormation accepted execution at 2026-09-08T05:33:50.187850+00:00 and reached **UPDATE_COMPLETE**.

## Verified after deployment

- Request, approval and redemption handlers are all published numeric **version 4**, Active, with code hashes matching their preserved version-3 predecessors.
- All three old version-3 handlers still exist.
- Enrollment, private approval and redemption deployment gates are enabled.
- Existing pairing integration targets request version 4; the default customer website integration remains unchanged.
- Four API Gateway invocation statements are restricted to request version 4, this account/API, and their exact pairing/request/redemption routes.
- Request permissions-boundary default version is v6. Its only allowed Lambda target is redemption version 4.
- Per-resource IAM simulation allows redemption version 4 and explicitly denies redemption version 3, unqualified redemption and approval version 4. This is boundary simulation, not a real operator credential test.
- Each enrollment handler retains reserved concurrency 1; each log group retains seven-day retention.
- The resource identifiers in both the enrollment-state and customer-staging stacks exactly match the pre-execution snapshot. No tables or customer-site resources were replaced. This is resource identity verification, not a scan of customer records.
- The operator has no inline policies. No operator grant was added.
- No approval, invitation redemption, repair seeding or customer linking was performed.

## Bounded hosted checks

All **14 credential-free HTTP checks** passed, including response security headers and no returned cookies/redirects.

- Homepage, privacy, terms and pairing assets return 200.
- Privacy identifies Alexander Ammann and the confirmed contact email.
- Anonymous session lookup, enrollment request, redemption, customer commands and Alexa endpoint access return 401.
- Forged service/role/customer headers and a synthetic session do not bypass customer authorization.
- Cross-origin redemption returns 403.
- Rejected responses return no customer data, invitation, request code or successful-link result.

Only synthetic headers/codes were used. This does not establish real IAM credential separation end to end, real customer sign-in, successful customer-A access, rejected signed-in customer-B access or Alexa+ account linking.
The adjacent JSON contains sanitized request IDs, configuration and resource evidence; no private identity/configuration values.

## Remaining controlled test and release gates

The privately supplied fictional-A designation expires **2026-09-08T09:25:13.430000+00:00**. Expiry prevents new approvals under that designation; it does not automatically disable deployed routes or revoke an already-created link. Do not extend or replace it without a reviewed update.

Next: separately review a finite non-root operator grant for **approval version 4** with fresh MFA, then perform a new authenticated request, approval and explicit customer redemption. Verify A-only access and rejected cross-customer access before recording the replacement demo.

The website/repair-ownership distinction remains mandatory. Deployment is not certification or submission readiness. Devpost submission and video publication remain paused.
