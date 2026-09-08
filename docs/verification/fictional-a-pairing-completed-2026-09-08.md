# Hosted fictional-A pairing completed — September 8, 2026

## Scope and result

The explicitly approved, single fictional customer-A enrollment completed against the hosted AWS service. This is a staging designation, not evidence of real-world repair ownership or Alexa+ account linking.

The local AWS CLI identity matched the exact `flo-staging-operator` ARN and immutable user ID. The unchanged reviewed version-4 boundary was attached and verified before the source-generated invocation baseline. The original 06:45 UTC deadline and MFA age requirement were not extended. An actual version-4 DryRun returned 204 before the private operation.

At approximately 06:32 UTC, one fresh customer request was captured in the isolated local Docker handoff. Its file permissions were 0600. The separately authorized operator wrapper ran once, using temporary credentials held in subprocess memory. The private output confirmed operator approval and matching request binding. Neither request code nor invitation was printed to chat or committed.

The original Amazon customer session explicitly redeemed that invitation with consent. A fresh navigation to the hosted home page displayed **“Signed in to Flo. Your shop-linked repairs are available.”** Sign out remained available. Logout removed the customer controls; a subsequent real Login with Amazon flow restored the linked state without creating another request or approval. This provides live evidence that the trusted mapping persists separately from the login session.

The customer then asked `List my repairs`. The hosted page reported `MCP tools executed: list_my_repairs` and returned an empty array with **“There are no repairs available for your account. Check with your shop.”** No repair fixtures were seeded. Do not infer successful hosted customer-A/customer-B repair-data isolation from an empty repair list.

## Cleanup verification

By 06:34 UTC, the temporary inline invocation policy was removed first, followed by its attached boundary and temporary managed policy. IAM read-back showed no inline policies, groups or boundary, and only the original `SignInLocalDevelopmentAccess` attachment.

Early post-removal DryRuns still returned 204 during the propagation interval. A subsequent bounded DryRun returned `AccessDeniedException`, explicitly because no identity-based policy allowed `lambda:InvokeFunction`. No further application invocation or approval was executed during these checks. Policy removal alone was not treated as proof of effective denial.

The private browser output was navigated away from. The dedicated `flo-handoff-live-20260908t0631z` container was stopped and automatically removed; its tmpfs request/invitation files disappeared with it. A filtered container listing found no remaining Flo handoff container. The intended customer link and audit data were preserved, as were the existing six-service Flo demo and AWS application resources.

## Fresh source checks

- Full workspace compilation and application regression suite: 151 total, 148 passed, three platform skips, zero failures.
- ESLint and TypeScript checks: passed.
- Node script suite on Windows: 89 total, 83 passed, six POSIX-only skips, zero failures.
- The two new private-handoff/runner suites in isolated Linux Docker: 12 passed, zero failures or skips; no AWS credentials or network access supplied.

## Remaining release gates

Hosted nonempty repair fixtures and wrong-customer access tests require their own scoped test setup; customer B was not linked. Official Alexa+ service/user authorization, tooling and applicable integration-route checks remain separate. A replacement demo must show the current consumer experience and corrected comparison ranking. A fresh pushed-source CI result, accurate final submission materials and final publication/submission approval remain required. This checkpoint does not claim certification, video publication or Devpost submission.
