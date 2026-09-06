import { build } from "esbuild";
import { mkdir, copyFile } from "node:fs/promises";

// Separate, opt-in artifacts. Does not change the existing customer-site bundle
// or package either handler into a CloudFormation/S3 deployment.
for (const [name, entry] of [["request", "customer-enrollment-request-lambda"], ["redemption", "customer-enrollment-redeem-lambda"], ["approval", "customer-enrollment-approval-lambda"]]) {
  const result = await build({ entryPoints: [`services/flo-mcp/src/${entry}.ts`], outfile: `dist/customer-enrollment/${name}/index.mjs`,
    bundle: true, platform: "node", target: "node22", format: "esm", sourcemap: false, metafile: true,
    banner: { js: 'import { createRequire } from "node:module"; const require = createRequire(import.meta.url);' } });
  const inputs = Object.keys(result.metafile.inputs);
  for (const forbidden of ["customer-enrollment-private.ts", "customer-enrollment-operator.ts", "customer-enrollment-dynamodb.ts", "customer-lambda.ts", ...(name === "approval" ? [] : ["customer-enrollment-dynamodb-approve.ts", "customer-enrollment-approval-lambda.ts"])]) {
    if (inputs.some(file => file.endsWith(`/${forbidden}`))) throw new Error(`Forbidden authority in ${name} artifact: ${forbidden}`);
  }
  if (name === "request" && inputs.some(file => file.endsWith("/customer-enrollment-dynamodb-redeem.ts"))) throw new Error("Public artifact must not contain link-creation adapter");
  if (name === "redemption" && inputs.some(file => file.endsWith("/customer-enrollment-dynamodb-start.ts"))) throw new Error("Private artifact must not contain request-creation adapter");
  if (name === "approval") for (const forbidden of ["customer-enrollment-dynamodb-start.ts", "customer-enrollment-dynamodb-redeem.ts", "customer-enrollment-invoke.ts", "customer-enrollment-runtime.ts"]) {
    if (inputs.some(file => file.endsWith(`/${forbidden}`))) throw new Error(`Approval artifact must not contain ${forbidden}`);
  }
}
await mkdir("dist/customer-enrollment/request/public", { recursive: true });
for (const name of ["pairing.html", "pairing.js"]) await copyFile(`services/flo-mcp/public/${name}`, `dist/customer-enrollment/request/public/${name}`);
console.info("Separate enrollment bundles built and dependency boundaries checked; no deployment performed.");
