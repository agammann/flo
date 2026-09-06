# Flo staging operator bootstrap — console sign-in with MFA verified

## Successful non-root sign-in verification

At `2026-09-06T04:26:08.681145+00:00`, read-only verification found a CloudTrail `ConsoleLogin` event in `us-east-2`:

- Event ID: `378ae7c7-fc2c-44fa-a5ce-52764d84f6ed`.
- Event time: `2026-09-06T04:24:00Z` (September 5, 9:24 PM Pacific).
- Identity type: `IAMUser`.
- ARN: `arn:aws:iam::114599789754:user/flo/flo-staging-operator`.
- Immutable principal ID: `AIDARVLVOAS5N5MWSFYR5`.
- `ConsoleLogin`: `Success`.
- `MFAUsed`: `Yes`.

The visible console independently identifies `flo-staging-operator` in account `114599789754`. AWS Health and cost widgets display missing-permission/access-denied messages; no permissions were granted to remove those messages. IAM `PasswordLastUsed` is now `2026-09-06T04:24:00+00:00`. The login profile and one MFA device remain configured; access keys, attached/inline user policies and group memberships remain empty.

CloudTrail lookups covered the last two hours in `us-east-1`, `us-east-2` and `us-west-2`, with no API errors. Only the matching identity's selected nonsecret login fields were retained; no client IP, credentials or MFA material was copied. This was not an all-region audit. The connector used to verify the records still authenticates as root; it was not switched to the operator or used to execute a customer approval.

This completes the operator **console sign-in** check. The programmatic MFA-bound approval credential path, least-privilege application grants, approved fictional-customer mapping and hosted allowed/denied enrollment tests remain separate unfinished work. The credentials CSV was not opened. No live policies, resources, tags, customer records or publication state changed. No application test suite was rerun for this read-only sign-in check.

Earlier sections below are historical checkpoints, superseded where this section records newer live evidence.

## Follow-up verification after owner completed setup

At `2026-09-06T04:16:25.149457+00:00`, read-only AWS API checks confirmed the same immutable user ID and ARN recorded below. `GetLoginProfile` now succeeds: the login profile was created at `2026-09-06T04:13:48+00:00`, with `PasswordResetRequired=false`. `ListMFADevices` reports one device, enabled at `2026-09-06T04:15:36+00:00`. No password, MFA seed, QR code, authentication code or access-token value was read.

`ListAccessKeys`, `ListAttachedUserPolicies`, `ListUserPolicies` and `ListGroupsForUser` still return empty lists. No permission was added by this verification. `GetUser` did not return `PasswordLastUsed`; the connected verification session remains the account root identity. Accordingly, successful non-root console sign-in and actual MFA challenge completion have **not** yet been verified. MFA enrollment alone does not establish enforcement for the future programmatic approval path.

Next: the owner signs in privately as `flo-staging-operator` using the account-specific console URL and completes MFA. Keep the current administrative session separate if possible. Then verify the resulting operator identity before proceeding to scoped application grants. Do not treat this AWS IAM identity as a Login with Amazon customer mapping. No deployment, application tests, policy attachment, customer linking or publication occurred in this follow-up. The bootstrap tag still describes the original pending state; no tag mutation was made.

The sections below preserve the original pre-credential bootstrap evidence, not current credential status.

## Scope and outcome

The user approved a dedicated, non-root, MFA-protected operator for fictional staging-customer approval, without administrator access or permanent access keys. This step created only the IAM identity. It did not grant application permissions or complete sign-in/MFA setup.

Account `114599789754` was checked immediately before creation. AWS Organizations returned `AWSOrganizationsNotInUseException`; IAM Identity Center returned no instances in the two regions checked, `us-west-2` and `us-east-1`. These results are not an all-region Identity Center audit. No organization or Identity Center instance was enabled. IAM users were empty before creation.

## Created identity

- Username: `flo-staging-operator`
- Path: `/flo/`
- ARN: `arn:aws:iam::114599789754:user/flo/flo-staging-operator`
- Immutable user ID: `AIDARVLVOAS5N5MWSFYR5`
- Created: `2026-09-06T04:06:54+00:00` (September 5 in the local Pacific timezone).
- Tags: `Project=Flo`, `Purpose=FictionalStagingApproval`, `BootstrapState=AwaitingPrivatePasswordAndMFA`.

The immutable ID is recorded for a future exact-identity operator grant; no such live grant has been provisioned by this step. A matching username alone must not authorize a deleted-and-recreated identity.

## Post-creation live verification

| API | Observed result |
| --- | --- |
| STS GetCallerIdentity | Expected account; provisioning session remains root, not the Flo operator |
| IAM GetUser | Exact ARN, path and immutable user ID above |
| IAM GetLoginProfile | `NoSuchEntity`: no console password/login profile |
| IAM ListAccessKeys | Empty |
| IAM ListMFADevices | Empty |
| IAM ListAttachedUserPolicies | Empty |
| IAM ListUserPolicies | Empty |
| IAM ListGroupsForUser | Empty |

The AWS console separately displayed console access disabled, no MFA devices and zero access keys. No customer-data access, approval execution, MFA enforcement or successful operator sign-in is claimed. These metadata checks are not a complete effective-permissions simulation.

## Human handoff and remaining gate

Opened the IAM user's **Security credentials** page. The account owner must privately assign an MFA device and enable console access with a password, completing credential entry and submission directly in AWS. Do not paste passwords, MFA setup material or codes into chat, files or the repository. Do not create access keys or attach administrator permissions.

After the owner confirms setup, refresh metadata and test the non-root sign-in. Then finish the separately scoped approval authorization design and verify MFA requirements for the actual approval credential path. Merely registering an MFA device is not proof that every programmatic operation requires MFA.

The existing customer-facing role remains outside this bootstrap; no application role/policy, Lambda, API route, table, secret, allowance or customer mapping was changed. No application source was edited and the full application test suite was not rerun for this identity-only step. Deployment, Devpost submission and video publication remain paused.

Earlier source/IAM readiness gaps remain in [the enrollment AWS preflight](customer-enrollment-aws-preflight-2026-09-05.md). Its zero-IAM-user inventory is a historical snapshot superseded by this bootstrap.

AWS references: [Creating an IAM user](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_users_create.html), [Assigning a passkey/security key](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_mfa_enable_fido.html).
