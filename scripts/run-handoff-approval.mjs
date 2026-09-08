import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const principal = "arn:aws:iam::114599789754:user/flo/flo-staging-operator";
const config = { purpose: "fictional_customer_pairing", account: "114599789754", region: "us-west-2",
  functionArn: "arn:aws:lambda:us-west-2:114599789754:function:flo-customer-enrollment-approval:4" };
// This is the reviewed test window, not an automatically renewable authorization.
export const invocationDeadline = Date.parse("2026-09-08T06:45:00Z");
const run = (binary, args, options) => execFileSync(binary, args, { encoding: "utf8", windowsHide: true, timeout: 15_000, maxBuffer: 131072, ...options });

/** Keep temporary credentials in process memory, never arguments/files/model output.
 * Local Docker administrators are trusted. The HTTP handoff process receives no credentials.
 * External review must attach the exact-version MFA boundary before execution.
 */
export function runHandoffApproval(container, execute = run, now = Date.now()) {
  if (!/^flo-handoff-live-[a-z0-9-]{1,40}$/.test(container) || now >= invocationDeadline) throw new Error("Reviewed live container and window required");
  const clean = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^(AWS|DOCKER)_/.test(key.toUpperCase())));
  clean.AWS_PAGER = ""; clean.AWS_MAX_ATTEMPTS = "1";
  const endpoint = JSON.parse(execute("docker", ["context", "inspect", "desktop-linux", "--format", "{{json .Endpoints.docker.Host}}"], { env: clean }));
  if (endpoint !== "npipe:////./pipe/dockerDesktopLinuxEngine") throw new Error("Local Docker Desktop pipe required");
  const docker = (args, options) => execute("docker", ["--context", "desktop-linux", ...args], options);
  const credentials = JSON.parse(execute("aws", ["configure", "export-credentials", "--profile", "flo-staging-operator", "--format", "process"], { env: clean }));
  if (credentials.Version !== 1 || !/^ASIA[A-Z0-9]{16}$/.test(credentials.AccessKeyId ?? "") ||
      typeof credentials.SecretAccessKey !== "string" || !credentials.SecretAccessKey || typeof credentials.SessionToken !== "string" || !credentials.SessionToken ||
      !Number.isFinite(Date.parse(credentials.Expiration)) || Date.parse(credentials.Expiration) <= now + 30_000) throw new Error("Current temporary credentials required");
  const env = { ...clean, AWS_ACCESS_KEY_ID: credentials.AccessKeyId, AWS_SECRET_ACCESS_KEY: credentials.SecretAccessKey,
    AWS_SESSION_TOKEN: credentials.SessionToken, AWS_REGION: "us-west-2", AWS_DEFAULT_REGION: "us-west-2" };
  const identity = JSON.parse(execute("aws", ["sts", "get-caller-identity", "--region", "us-west-2", "--no-cli-pager", "--output", "json"], { env }));
  if (identity.Arn !== principal || identity.UserId !== "AIDARVLVOAS5N5MWSFYR5" || identity.Account !== config.account) throw new Error("Wrong operator identity");
  const info = JSON.parse(docker(["inspect", "--format", "{{json .}}", container], { env: clean }));
  const ports = info.NetworkSettings?.Ports?.["4311/tcp"];
  if (!info.State?.Running || !info.HostConfig?.ReadonlyRootfs || !info.HostConfig?.Tmpfs?.["/private"] ||
      !Array.isArray(ports) || ports.length !== 1 || ports[0].HostIp !== "127.0.0.1" ||
      (info.Mounts ?? []).some(m => m.Destination !== "/app/scripts/private-handoff.mjs" || m.RW)) throw new Error("Unexpected container isolation");
  const init = "import {readFileSync,writeFileSync} from 'node:fs'; const c=JSON.parse(readFileSync(0,'utf8')); writeFileSync('/private/config.json',JSON.stringify(c),{mode:384,flag:'wx'});";
  docker(["exec", "-i", container, "node", "--input-type=module", "-e", init], { env: clean, input: JSON.stringify(config) });
  const names = ["AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "AWS_SESSION_TOKEN", "AWS_REGION", "AWS_DEFAULT_REGION", "AWS_MAX_ATTEMPTS"];
  // Exactly one operator command. Its output reservation prevents accidental reapproval.
  docker(["exec", ...names.flatMap(name => ["-e", name]), container, "node", "scripts/approve-customer-enrollment.mjs",
    "/private/config.json", "/private/request.json", "/private/invitation.json"], { env });
  return { operatorCommandCompleted: true, customerRedemptionRequired: true };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    if (process.argv.length !== 4 || process.argv[2] !== "--execute-reviewed-v4") throw new Error("Explicit reviewed execution required");
    runHandoffApproval(process.argv[3]);
    console.info("Operator command completed. Output remains private; customer redemption is still required.");
  } catch { console.error("Approval not confirmed. Do not retry, reveal child output or overwrite private files. Check the reviewed window, identity and private state."); process.exitCode = 1; }
}
