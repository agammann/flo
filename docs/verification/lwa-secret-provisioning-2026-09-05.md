# LWA secret provisioning — September 5, 2026 (Pacific)

> Subsequent preparation found a credential-length bug in the deployed application. A corrected, tested replacement ZIP is ready but not uploaded or deployed; see [LWA configuration fix](lwa-config-fix-2026-09-05.md). Do not enable the old package merely by filling these parameters.

The owner explicitly requested storage of the already supplied client credential after the conversation-exposure risk and rotation recommendation were explained. Stored the supplied value in AWS Secrets Manager without creating a local plaintext file or adding it to repository content. This does not undo its disclosure in conversation/tool history and does not establish credential validity with Amazon. Rotation remains recommended before release.

- Account `114599789754`, region `us-west-2`.
- Secret name: `flo/customer-staging/lwa`.
- ARN: `arn:aws:secretsmanager:us-west-2:114599789754:secret:flo/customer-staging/lwa-hwN6ke`.
- JSON field: `clientSecret` (value intentionally omitted).
- CreateSecret succeeded; version `7562a864-a5c7-4bb7-950e-94816eece7ae`.
- DescribeSecret and ListSecretVersionIds independently returned this version as **AWSCURRENT**, using `DefaultEncryptionKey`.
- No GetSecretValue/BatchGetSecretValue call was made. Verification was metadata only.
- No prior secret with this exact name existed; nothing was overwritten.

The deployed customer stack remains `UPDATE_COMPLETE`, with `LwaEnabled=false`, empty `LwaClientId`, and empty `LwaSecretId`. No deployment or login test was performed in this provisioning step. Stored credentials are not automatically wired into Lambda. The next configuration update must use the public client ID and the secret reference, preserve the approved limits and code bindings, and undergo change-set review before execution.

No customer mapping was written. An initially unlinked real sign-in must continue to deny repair access. No hosted successful sign-in, real linked-customer isolation, official Alexa+ linking or certification is claimed. Submission and video publication remain paused.
