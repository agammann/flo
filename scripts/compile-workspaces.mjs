import process from "node:process";
import path from "node:path";
import ts from "typescript";

const projects = [
  "packages/shared-types/tsconfig.json",
  "packages/domain/tsconfig.json",
  "packages/compatibility-engine/tsconfig.json",
  "packages/estimate-engine/tsconfig.json",
  "packages/adapters/tsconfig.json",
  "packages/agent/tsconfig.json",
  "services/mock-shop-api/tsconfig.json",
  "services/mock-inventory-api/tsconfig.json",
  "services/mock-supplier-api/tsconfig.json",
  "services/mock-customer-api/tsconfig.json",
  "services/flo-mcp/tsconfig.json",
  "apps/alexa-simulator/tsconfig.json",
  "tests/tsconfig.json"
];

const noEmit = process.argv.includes("--noEmit");
let failed = false;
const formatHost = {
  getCanonicalFileName: (fileName) => fileName,
  getCurrentDirectory: ts.sys.getCurrentDirectory,
  getNewLine: () => ts.sys.newLine
};

for (const project of projects) {
  const absoluteProject = path.resolve(project);
  const config = ts.readConfigFile(absoluteProject, ts.sys.readFile);
  if (config.error) {
    console.error(ts.formatDiagnostic(config.error, formatHost));
    failed = true;
    continue;
  }
  const directory = path.dirname(absoluteProject);
  const overrides = noEmit ? { noEmit: true } : undefined;
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, directory, overrides, absoluteProject);
  if (parsed.fileNames.length === 0) {
    console.error(`No TypeScript inputs found for ${project}.`);
    failed = true;
    continue;
  }
  const program = ts.createProgram({ rootNames: parsed.fileNames, options: parsed.options, projectReferences: parsed.projectReferences });
  const emit = noEmit ? undefined : program.emit();
  const diagnostics = ts.getPreEmitDiagnostics(program).concat(emit?.diagnostics ?? []);
  if (diagnostics.length > 0) {
    console.error(ts.formatDiagnosticsWithColorAndContext(diagnostics, formatHost));
    failed = true;
  } else {
    console.log(`${noEmit ? "typecheck" : "build"}: ${project}`);
  }
}

if (failed) process.exitCode = 1;
