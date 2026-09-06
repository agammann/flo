import { runPrivateEnrollmentApproval } from "../services/flo-mcp/dist/customer-enrollment-private.js";

// Only private file paths belong on the command line. Never paste request or
// invitation codes, AWS credentials, or the LWA secret into arguments or stdout.
const [config, request, output, ...extra] = process.argv.slice(2);
if (!config || !request || !output || extra.length) {
  console.error("Usage: node scripts/approve-customer-enrollment.mjs <private-config.json> <private-request.json> <new-private-output.json>");
  process.exitCode = 1;
} else {
  try {
    await runPrivateEnrollmentApproval({ config, request, output });
    console.info("Operator approval recorded; invitation saved to the requested private file. Customer redemption is still required. No customer link was created by this command.");
  } catch {
    // SDK/Zod/filesystem errors may contain identifiers or private input. Never dump them.
    console.error("Approval could not be confirmed. Do not automatically retry or overwrite output. Review private state; an uncertain request must expire before starting again.");
    process.exitCode = 1;
  }
}
