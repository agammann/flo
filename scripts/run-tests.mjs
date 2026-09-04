import { readdir } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import path from "node:path";

const roots = process.argv.slice(2);
const selectedRoots = roots.length === 0 ? ["packages", "services", "tests"] : roots;

const collect = async (directory) => {
  const entries = await readdir(directory, { withFileTypes: true }).catch(() => []);
  const files = await Promise.all(entries.map(async (entry) => {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) return collect(absolute);
    return entry.isFile() && entry.name.endsWith(".test.js") && absolute.includes(`${path.sep}dist${path.sep}`) ? [absolute] : [];
  }));
  return files.flat();
};

const testFiles = (await Promise.all(selectedRoots.map((root) => collect(path.resolve(root))))).flat().sort();
if (testFiles.length === 0) {
  console.error("No compiled test files found. Run the build first.");
  process.exitCode = 1;
} else {
  for (const file of testFiles) await import(pathToFileURL(file).href);
}
