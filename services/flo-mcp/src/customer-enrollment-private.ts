import { constants } from "node:fs";
import { lstat, open, realpath } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { LambdaClient } from "@aws-sdk/client-lambda";
import { z } from "zod";
import { LambdaEnrollmentApproval } from "./customer-enrollment-approval-invoke.js";
import { privateApprovalRequest } from "./customer-enrollment-approval-protocol.js";

const configSchema = z.object({ purpose: z.literal("fictional_customer_pairing"), account: z.string().regex(/^\d{12}$/),
  region: z.string().regex(/^us-(east|west)-[12]$/),
  functionArn: z.string().min(1).max(256)
}).strict();
const requestSchema = privateApprovalRequest;
export type PrivateEnrollmentConfig = z.infer<typeof configSchema>;
export type PrivateEnrollmentRequest = z.infer<typeof requestSchema>;
type Approve = (config: PrivateEnrollmentConfig, request: PrivateEnrollmentRequest) => Promise<{ invitation: string; status: "operator_approved" }>;

/** POSIX-only private operator workspace. Refuse Windows rather than pretend file
 * mode bits enforce Windows ACLs. CloudShell/Linux is the intended runtime.
 * Never read credential files or fetch secret values: SDK uses its credential chain.
 */
async function privateDirectory(path: string) {
  if (process.platform === "win32" || !process.getuid) throw new Error("Private approval requires POSIX file permissions");
  const absolute = resolve(path);
  if (await realpath(absolute) !== absolute) throw new Error("Canonical private directory required");
  const stat = await lstat(absolute);
  if (!stat.isDirectory() || stat.uid !== process.getuid() || (stat.mode & 0o077) !== 0) throw new Error("Operator-owned 0700 directory required");
}
async function privateJson(path: string): Promise<unknown> {
  await privateDirectory(dirname(path));
  const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const stat = await file.stat();
    if (!stat.isFile() || stat.nlink !== 1 || stat.uid !== process.getuid!() || (stat.mode & 0o077) !== 0 || stat.size > 16_384) throw new Error("Private bounded input file required");
    return JSON.parse(await file.readFile("utf8")) as unknown;
  } finally { await file.close(); }
}

/** No public HTTP handler invokes this function. IAM must restrict this process
 * to the exact reviewed published approval version with MFA, without table writes
 * or permission to change deployment configuration. Local config is not authority.
 */
export async function approveWithPrivateAws(config: PrivateEnrollmentConfig, request: PrivateEnrollmentRequest) {
  const client = new LambdaClient({ region: config.region, maxAttempts: 1, requestHandler: { connectionTimeout: 1000, requestTimeout: 9000 } });
  try {
    return await new LambdaEnrollmentApproval(client, config.functionArn, config.account, config.region).approve(request);
  } finally { client.destroy(); }
}

/** Reserve output BEFORE mutation. Existing/symlink output fails without an AWS
 * call. If persistence fails after approval, do not auto-retry/reapprove: keep the
 * request fail-closed and let it expire. This command cannot create customer links.
 */
export async function runPrivateEnrollmentApproval(paths: { config: string; request: string; output: string }, approve: Approve = approveWithPrivateAws): Promise<void> {
  const config = configSchema.parse(await privateJson(paths.config));
  const request = requestSchema.parse(await privateJson(paths.request));
  await privateDirectory(dirname(paths.output));
  const output = await open(paths.output, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
  try {
    const result = await approve(config, request);
    if (result.status !== "operator_approved" || !/^[A-Za-z0-9_-]{43}$/.test(result.invitation)) throw new Error("Invalid approval result");
    await output.writeFile(JSON.stringify({ requestCode: request.requestCode, invitation: result.invitation, status: result.status }) + "\n", "utf8");
    await output.sync();
  } finally { await output.close(); }
}
