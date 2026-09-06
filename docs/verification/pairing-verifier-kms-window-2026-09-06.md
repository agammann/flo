# KMS verifier window: live probes passed, separate request runtime blocked

## Completed and cleaned up

The owner approved the reviewed temporary correction and completed fresh MFA.
IAM confirmed sign-in at 2026-09-06T19:02:47Z. The deadline was 19:32:00Z,
less than 30 minutes from attachment. The live generator differed from the
reviewed artifact only in its deadline. Access Analyzer returned zero findings.
The boundary was attached and read back before adding the two temporary grants;
all three policy documents matched the reviewed source.

The CloudShell verifier matched SHA-256
`a48d0d8eed12578cf54b2dd8157e04e04cb294689ed9e32e13a3731930c1f45d`.
Its one execution produced three live PASS results:

1. Six-field projected read on a random synthetic key succeeded with no item.
2. Unprojected read on that key was rejected by AWS.
3. Proof-field read on that key was rejected by AWS.

CloudTrail independently recorded successful operator Decrypt at 19:06:13Z,
MFA authenticated, session creation 19:02:47Z, and matching DynamoDB table-name
and subscriber context. This is actual downstream execution evidence, not only
a policy simulation. It does not prove authorization to a customer repair.

## One request attempt stopped safely

The separate Flo session had expired. Login with Amazon was refreshed through
the existing consent flow, restoring signed-in/unlinked state. Exactly one
private pairing request was attempted. The page reported that the connection
could not be confirmed; API access logs record HTTP 503 at 19:08:15Z.
No request code was obtained, no automatic retry occurred, and no real request
was read. The hidden verifier prompt was exited with empty input; it stopped
at private-input with ValueError before any request lookup. No private
observation file was created by this run.

The temporary grants were removed first and absence verified, then the boundary
was detached and its temporary managed policy deleted. Final IAM reads at
19:09:01Z show no inline grants, no boundary, no groups, and only the existing
SignInLocalDevelopmentAccess attachment. No application resources were deleted.
The permission documents remain reproducible from the reviewed local source.

## Separate runtime defect identified, not changed live

CloudTrail at 19:08:15Z records kms:Decrypt AccessDenied for the execution role
of flo-customer-enrollment-request, explicitly caused by a permissions boundary.
The deployed v4 boundary allows only its Lambda environment key and Lambda
function encryption context; DenyOtherEnvironmentKeys and DenyWrongDecryptFunction
also deny the legitimate DynamoDB dependency. The identity policy already
contains the Autopilot-generated DynamoDB-mediated Decrypt grant.

The request Lambda completed normally at the runtime level (550.568 ms), but
the application returned 503. A Lambda platform.report status of success must
not be confused with successful request creation. The denied event omitted
requestParameters, so its exact attempted table/key is not established by that
event alone. Do not infer that a request exists or scan for it.

The next correction must separately scope the application runtime's DynamoDB
key/table dependencies while preserving Lambda environment decryption and all
existing data-action, transaction, and customer-ownership boundaries. Validate
and review the exact CloudFormation changes before deployment. No application
boundary, function code, or deployment configuration was changed by this test.

Approval and redemption version 3 remain disabled. No approval, invitation,
customer link, video publication, GitHub push, or Devpost submission occurred.
