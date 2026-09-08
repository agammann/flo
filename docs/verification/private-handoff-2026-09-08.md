# Local private handoff — September 8, 2026

## Scope

This local staging helper solves the browser-to-operator transfer problem without exporting customer cookies, pasting codes into chat, or giving the browser an approval API. It is not an Alexa+ integration, a production enrollment interface or proof of customer ownership.

`scripts/private-handoff.mjs` has no AWS SDK, subprocess execution or credential loading. Run it only in a dedicated local Docker container with a read-only root filesystem, no privileges/capabilities, finite resources, `127.0.0.1:4311` port publication and `/private` as a small 0700 tmpfs. Do not expose it on the LAN, mount AWS credentials/the Docker socket, or add a public tunnel. The container must have no startup AWS environment variables. Local OS/Docker administrators are trusted; this is not isolation from a compromised host.

The server exits after ten minutes. It accepts one request code through a same-origin, cookie/CSRF-protected form and reserves `/private/request.json` exclusively with 0600 permissions. No overwrite or automatic retry is available. Headers prevent caching and framing. No codes occur in URLs, logs or browser storage. The private response page exposes output only to the local browser cookie and only when its request code matches the captured input. It refuses malformed, symlinked, nonprivate or unconfirmed output. Its three-minute output-display limit does not extend the authoritative hosted request lifetime.

## Separate operator command

`scripts/run-handoff-approval.mjs` is deliberately separate from the HTTP server. It requires an explicit `--execute-reviewed-v4` flag and a `flo-handoff-live-*` container. The current test-specific source is fixed to the reviewed approval version 4 and **2026-09-08 06:45 UTC** deadline; it refuses after that deadline. Updating this local guard does not grant AWS permission or extend the separately deployed designation.

The wrapper verifies the local Docker Desktop named-pipe endpoint before obtaining credentials. It privately captures temporary credentials from the existing `flo-staging-operator` AWS CLI profile, verifies STS using those exact exported credentials, checks the target container's isolation, then passes credentials by environment-variable **names**, not values in arguments. Only the invocation subprocess receives them; the HTTP process is not given them. Docker/host administrators can inspect running processes and are inside the trusted boundary. No credential file is written or secret fetched from Secrets Manager.

The wrapper invokes the existing private approval command exactly once. That command reserves its private output before the AWS call, uses no automatic SDK retries or log tail, and saves the invitation privately. The browser page cannot call the wrapper. Apply and verify the independently reviewed exact-version/MFA IAM boundary before any live run. Remove the temporary grant before removing its boundary afterward. Local configuration and the CLI user's identity are not evidence of repair ownership; the deployed independently reviewed fictional-A designation remains authoritative.

## Actual verification

- Local Docker HTTP/file tests passed: one-request capture, cookie/CSRF/origin/host/content validation, no cache/framing/CORS, absent/mismatched/nonprivate output rejection, no symlink overwrite, and private directory/lifetime checks.
- Wrapper tests passed with mocked subprocesses: exact identity, environment-only credentials, rejection of root/wrong user/long-term/expired credentials, local-only Docker endpoint, expired test window, unexpected container configuration and no retry after uncertain execution.
- Browser testing found `Origin: null` on native form POSTs under `Referrer-Policy: no-referrer`. The helper now uses `same-origin`; strict origin validation was retained. There are no sensitive URL parameters.
- A synthetic code copied from the existing Flo browser field into the local handoff form was actually captured in Docker and its content/mode verified. This did **not** submit an enrollment request to AWS.
- A synthetic output fixture exercised the browser return controls without pressing Flo's redemption button. This is not evidence of successful live redemption or a customer link.
- The new helper's Linux checks run through the existing `node --test scripts/*.test.mjs` CI step. POSIX file tests intentionally skip on Windows and were separately executed in Linux Docker.
- Full application suite: 148 passed, 3 skipped, zero failures. Build, lint and typecheck passed at this checkpoint. No fresh GitHub Actions run or live pairing result is claimed.

## Live sequence after explicit approval

1. Ensure the handoff, AWS invocation and designation windows remain valid. Fresh operator login/MFA and any temporary IAM attachment require the reviewed approval; never fall back to root.
2. Start a fresh **live** handoff container, never reuse a synthetic or uncertain request. Verify the container and exact invocation artifacts before input.
3. From the original signed-in Flo session, explicitly consent and create one private request. Copy its Request code field to the local form and capture it once. Do not snapshot/record a page while live codes are visible.
4. Run the reviewed private wrapper once. If it cannot confirm approval, preserve private state for the scoped investigation, remove temporary IAM access, and let the request expire. Never overwrite the output or issue a replacement invitation automatically.
5. Return the matching request and invitation only to the original Flo session. Explicit customer consent and redemption are still required. Recheck `/auth/session` and ownership denial afterward; do not infer repair fixtures exist.
6. Remove temporary IAM access in the reviewed order, clear browser fields, close the handoff tab, and stop only the dedicated temporary container. Its tmpfs disappears with the container. Keep intended fictional link/audit records; do not reset other Flo services.

The subsequent [single hosted fictional-A test](fictional-a-pairing-completed-2026-09-08.md)
completed approval, explicit redemption, logout and fresh-login persistence. Its
temporary IAM grant and private container were removed. The synthetic checks
above remain distinct evidence. Hosted nonempty repair isolation, video
publication and Devpost submission remain separate gates.
