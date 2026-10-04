// Prints the test files whose tests have to be read one by one against their
// own file (AC-3, tickets 26-31): tracked test files matching an include
// pattern and no exclude pattern, not listed in ac3-reviewed.txt, that reach
// another project file - the test or its own file imports (not type-only) a
// project module other than its own file, or reads one at run time
// (`readFile`, `readFileSync`, `?raw`). An imported fixture (`*.fixtures.*`)
// or `src/test/` file is no reason by itself; what it imports is, one level
// deep.
//
//   node changes/2026-10-03-tests-ihren-dateien-zuordnen/select-tests.mjs \
//     'src/map/*.test.tsx' 'src/map/use*.test.ts' \
//     --exclude src/map/SituationMap.test.tsx

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const changeDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(changeDir, "../..");
const usage = `usage: node ${path.relative(process.cwd(), fileURLToPath(import.meta.url))} <include-glob>... [--exclude <glob>...]`;
const extensions = [".ts", ".tsx", ".mjs", ".js"];

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2));
}

function main(args) {
  const { include, exclude } = parseArgs(args);
  if (include.length === 0) {
    console.error(usage);
    process.exit(2);
  }
  const testFiles = execFileSync("git", ["ls-files"], {
    cwd: repoRoot,
    encoding: "utf8",
  })
    .split("\n")
    .filter((file) => file.includes(".test."));
  const reviewed = readFileSync(path.join(changeDir, "ac3-reviewed.txt"), "utf8")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const read = (file) => {
    try {
      return readFileSync(path.join(repoRoot, file), "utf8");
    } catch {
      return undefined;
    }
  };
  for (const file of selectTests({ testFiles, include, exclude, reviewed, read })) {
    console.log(file);
  }
}

function parseArgs(args) {
  const at = args.indexOf("--exclude");
  return at === -1
    ? { include: args, exclude: [] }
    : { include: args.slice(0, at), exclude: args.slice(at + 1) };
}

/** `read(file)` gives a repository-relative file's text, or undefined if there is none. */
export function selectTests({ testFiles, include, exclude, reviewed, read }) {
  const reviewedFiles = new Set(reviewed);
  return testFiles.filter(
    (file) =>
      include.some((glob) => path.matchesGlob(file, glob)) &&
      !exclude.some((glob) => path.matchesGlob(file, glob)) &&
      !reviewedFiles.has(file) &&
      reachesAnotherFile(file, read),
  );
}

function reachesAnotherFile(testFile, read) {
  const ownFile = sourceOf(testFile, read);
  const isOther = (file) => file !== testFile && file !== ownFile;
  return [testFile, ownFile]
    .filter((file) => file !== undefined)
    .flatMap((file) => filesReachedBy(file, read))
    .filter(isOther)
    .some(
      (file) =>
        !isHelper(file) ||
        filesReachedBy(file, read).some(
          (inner) => isOther(inner) && !isHelper(inner),
        ),
    );
}

function sourceOf(testFile, read) {
  const stem = testFile.replace(/\.test\.[^.]+$/, "");
  return extensions
    .map((extension) => stem + extension)
    .find((file) => read(file) !== undefined);
}

function isHelper(file) {
  return /\.fixtures\./.test(file) || file.startsWith("src/test/");
}

function filesReachedBy(file, read) {
  const text = read(file) ?? "";
  const imported = importedSpecifiers(text).map((specifier) =>
    resolveModule(file, specifier, read),
  );
  const readAtRunTime = readFileArguments(text).map((literal) =>
    resolveReadPath(file, literal, read),
  );
  return [...imported, ...readAtRunTime].filter((found) => found !== undefined);
}

function importedSpecifiers(text) {
  const withClause =
    /\b(?:import|export)\s+(type\s+)?([\w$*{}\s,]+?)\s+from\s*["']([^"']+)["']/g;
  const bare = /\bimport\s*["']([^"']+)["']/g;
  const dynamic = /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g;
  return [
    ...[...text.matchAll(withClause)]
      .filter(([, type, clause]) => !type && !onlyInlineTypes(clause))
      .map((match) => match[3]),
    ...[...text.matchAll(bare)].map((match) => match[1]),
    ...[...text.matchAll(dynamic)].map((match) => match[1]),
  ];
}

// `import { type A, type B } from "x"` imports nothing at run time either.
function onlyInlineTypes(clause) {
  const braces = clause.trim().match(/^\{([\s\S]*)\}$/);
  if (!braces) return false;
  const names = braces[1]
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);
  return names.length > 0 && names.every((name) => name.startsWith("type "));
}

function resolveModule(fromFile, specifier, read) {
  const bare = specifier.replace(/\?.*$/, "");
  let base;
  if (bare.startsWith("@/")) base = `src/${bare.slice(2)}`;
  else if (bare.startsWith(".")) base = path.posix.join(path.posix.dirname(fromFile), bare);
  else return undefined;
  return [
    base,
    ...extensions.map((extension) => base + extension),
    ...extensions.map((extension) => `${base}/index${extension}`),
  ].find((file) => read(file) !== undefined);
}

// The string literals in each `readFile(...)` / `readFileSync(...)` call.
function readFileArguments(text) {
  const literals = [];
  for (const call of text.matchAll(/\breadFile(?:Sync)?\s*\(/g)) {
    const args = balancedArguments(text, call.index + call[0].length);
    for (const literal of args.matchAll(/["'`]([^"'`]+)["'`]/g)) {
      literals.push(literal[1]);
    }
  }
  return literals;
}

function balancedArguments(text, start) {
  let depth = 1;
  for (let at = start; at < text.length; at++) {
    if (text[at] === "(") depth++;
    if (text[at] === ")") depth--;
    if (depth === 0) return text.slice(start, at);
  }
  return text.slice(start);
}

// A path read at run time is relative to the repository root (the working
// directory tests run in) or, as with `new URL(..., import.meta.url)`, to the
// file.
function resolveReadPath(fromFile, literal, read) {
  return [
    path.posix.normalize(literal),
    path.posix.join(path.posix.dirname(fromFile), literal),
  ].find((file) => read(file) !== undefined);
}
