import { build } from "esbuild";
import { mkdir, copyFile, writeFile } from "node:fs/promises";

await mkdir("dist/customer-staging/public", { recursive: true });
if (!process.argv.includes("--assets-only")) await build({ entryPoints: ["services/flo-mcp/src/customer-lambda.ts"], outfile: "dist/customer-staging/index.mjs", bundle: true, platform: "node", target: "node22", format: "esm", sourcemap: false, banner: { js: 'import { createRequire } from "node:module"; const require = createRequire(import.meta.url);' } });
for (const name of ["signin.html", "signin.js", "signin.css", "privacy.html", "terms.html"]) await copyFile(`services/flo-mcp/public/${name}`, `dist/customer-staging/public/${name}`);
await writeFile("dist/customer-staging/package.json", JSON.stringify({ type: "module", private: true }));
console.info(process.argv.includes("--assets-only") ? "Customer staging assets copied; bundle must be built separately." : "Customer staging Lambda bundle built; no deployment performed.");
