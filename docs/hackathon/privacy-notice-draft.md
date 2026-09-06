# Flo privacy notice — DRAFT FOR OWNER REVIEW

Not published. Do not register this file's local path or an invented URL with Amazon. The owner confirmed the operator identity and monitored email below on September 5, 2026. Hosting configuration and retention statements still need verification against the deployed service before publication or live sign-in. This draft describes the intended limited test release, not a certified or generally available repair service.

## About this preview

Flo is an open-source prototype for reviewing repair status and estimates. The test environment uses fictional repair records. Do not submit real repair, vehicle, payment or other sensitive information to the preview. Customer approvals, payments, purchases and appointment changes are not available through the customer website.

Operator: **Alexander Ammann**, as confirmed by the project owner on September 5, 2026.

Privacy contact: [xyes47314@gmail.com](mailto:xyes47314@gmail.com). The owner confirmed this inbox is monitored and receives mail. This is owner confirmation, not an independently performed delivery test. The GitHub maintainer is `agammann`.

## Information used for sign-in

When Login with Amazon is enabled and you choose to sign in, Amazon authenticates you. Flo does not receive your Amazon password. Flo requests your Amazon user identifier and uses authorization credentials on its server to validate the sign-in. The current integration does not request your email, name, postal address or payment information from Amazon.

Flo uses essential, secure session cookies and temporary login-state cookies. They are used for sign-in security and maintaining the website session, not advertising. Signing out of Flo ends the Flo session; it does not sign you out of Amazon.

## Repair access is separate from sign-in

An Amazon sign-in alone does not grant access to any repair. A trusted shop operator must separately verify and associate the Amazon identity with the correct shop customer record. An unlinked account receives no repair data. This test release must use approved test identities and fictional records; a real-customer enrollment process has not been released.

The customer website returns only the permitted repair status and customer estimate information. It does not expose internal supplier cost, shop margin, private diagnostic notes, customer contact information or VINs.

## Processing and service providers

Amazon processes the sign-in under its own terms and privacy practices. The planned public test deployment will use AWS for hosting and secure server operation. Hosting services necessarily process connection and request information. The deployment must be reviewed to avoid recording authorization codes, tokens, cookies, sensitive query strings or repair text in application/access logs.

The customer sign-in/repair preview does not send these details to the separate Bedrock narrator. No advertising or analytics trackers are intentionally included in the current customer website code.

## Retention and deletion

The current local implementation limits a Flo session to 15 minutes or the Amazon credential expiry, whichever is earlier, and does not retain refresh tokens. Logout invalidates that Flo session. Login state expires after five minutes. A trusted operator can revoke repair access by removing or deactivating the customer link.

**Public deployment retention requires verification before publication:** the local implementation stores sessions in process memory, whereas a distributed AWS deployment will need an expiring shared store. Expiry must be enforced when authorizing access, not delegated solely to eventual database cleanup. Any physical deletion delay, retained link records, backups and infrastructure log retention must be stated accurately here after the deployment is designed. Seven-day operational log retention is proposed, not yet deployed for the customer website.

## Your choices and privacy requests

You can decline sign-in, sign out of Flo or ask the operator to remove your customer association. Email [xyes47314@gmail.com](mailto:xyes47314@gmail.com) to request access, correction or deletion; do not post identity information, repair records, passwords or tokens to public GitHub issues. Do not send passwords or authorization tokens by email.

## Audience and changes

Flo's developer/repair-information preview is not directed at children. This is not a representation of Alexa+ certification. The operator must update this notice when the deployed data practices change and display the effective date of the approved version.
