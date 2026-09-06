import { createHash } from "node:crypto";
import { readdir, readFile, mkdir, writeFile } from "node:fs/promises";

// Build provenance only. No environment values, Git internals or credentials.
const files = ["package.json", "pnpm-lock.yaml", "pnpm-workspace.yaml", "tsconfig.json", "Dockerfile", "scripts/build-customer-staging.mjs", "scripts/compile-workspaces.mjs"];
async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (["dist", "node_modules", ".private"].includes(entry.name) || entry.name.startsWith(".")) continue;
    const path = `${directory}/${entry.name}`;
    if (entry.isSymbolicLink()) throw new Error(`Unexpected source symlink: ${path}`);
    if (entry.isDirectory()) await walk(path);
    else if (!entry.name.endsWith(".test.ts") && /\.(ts|js|mjs|json|html|css)$/.test(entry.name)) files.push(path);
  }
}
for (const directory of ["packages", "services", "apps"]) await walk(directory);
const records = [];
for (const path of files.sort()) records.push({ path, sha256: createHash("sha256").update(await readFile(path)).digest("hex") });
await mkdir("dist", { recursive: true });
await writeFile("dist/customer-source-manifest.json", JSON.stringify({ schemaVersion: 1, scope: "Runtime sources, public assets, package/build configuration; excludes tests and generated outputs", files: records }, null, 2));
console.info(`Customer source manifest generated: ${records.length} files; no deployment performed.`);
