// Lists every test name that disappeared and every one that appeared (AC-11),
// collected with `vitest list`, which runs the test files' top level and so
// also sees each row of an `it.each` / `describe.each` table. Collecting needs
// no test database. Removed tests print as the lines of a commit's
// `Removed tests:` record.
//
//   node changes/2026-10-03-tests-ihren-dateien-zuordnen/removed-tests.mjs
//     compares HEAD with the working tree, staged or not
//   node changes/2026-10-03-tests-ihren-dateien-zuordnen/removed-tests.mjs <from> <to>
//     compares two commits

import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, symlinkSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const usage = `usage: node ${path.relative(process.cwd(), fileURLToPath(import.meta.url))} [<from-commit> <to-commit>]`;
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2));
}

function main(args) {
  if (args.length !== 0 && args.length !== 2) {
    console.error(usage);
    process.exit(2);
  }
  // Ctrl-C stops the running child; the script lives on to remove its worktree.
  process.on("SIGINT", () => {});
  const [from, to] = args.length === 2 ? args : ["HEAD", null];
  const before = collectTestsAtCommit(from);
  const after = to === null ? collectTestsIn(repoRoot) : collectTestsAtCommit(to);
  process.stdout.write(
    formatComparison(
      compareTestLists(before.tests, before.root, after.tests, after.root),
    ),
  );
}

export function compareTestLists(before, beforeRoot, after, afterRoot) {
  const beforeNames = testNames(before, beforeRoot);
  const afterNames = testNames(after, afterRoot);
  return {
    removed: withoutEach(beforeNames, afterNames),
    added: withoutEach(afterNames, beforeNames),
  };
}

export function formatComparison({ removed, added }) {
  const sections = [];
  if (removed.length > 0) {
    sections.push(["Removed tests:", ...removed.map((name) => `- ${name}`)]);
  }
  if (added.length > 0) {
    sections.push(["Added tests:", ...added.map((name) => `+ ${name}`)]);
  }
  return sections.map((lines) => `${lines.join("\n")}\n`).join("\n");
}

function testNames(tests, root) {
  return tests.map(
    ({ file, name }) =>
      `${path.relative(root, file)} › ${name.split(" > ").join(" › ")}`,
  );
}

// Each name in `names` that `others` does not match one for one.
function withoutEach(names, others) {
  const unmatched = new Map();
  for (const name of others) {
    unmatched.set(name, (unmatched.get(name) ?? 0) + 1);
  }
  return names.filter((name) => {
    const count = unmatched.get(name) ?? 0;
    if (count === 0) return true;
    unmatched.set(name, count - 1);
    return false;
  });
}

function collectTestsAtCommit(commit) {
  const checkout = mkdtempSync(path.join(os.tmpdir(), "removed-tests-"));
  try {
    run(
      "git",
      ["worktree", "add", "--quiet", "--detach", checkout, commit],
      repoRoot,
    );
  } catch (error) {
    rmSync(checkout, { recursive: true, force: true });
    throw error;
  }
  try {
    symlinkSync(
      path.join(repoRoot, "node_modules"),
      path.join(checkout, "node_modules"),
    );
    return collectTestsIn(checkout);
  } finally {
    run("git", ["worktree", "remove", "--force", checkout], repoRoot);
    rmSync(checkout, { recursive: true, force: true });
  }
}

function collectTestsIn(root) {
  const listDir = mkdtempSync(path.join(os.tmpdir(), "removed-tests-list-"));
  const listFile = path.join(listDir, "tests.json");
  try {
    run(
      "npx",
      ["vitest", "list", "--no-staticParse", `--json=${listFile}`],
      root,
    );
    return { tests: JSON.parse(readFileSync(listFile, "utf8")), root };
  } finally {
    rmSync(listDir, { recursive: true, force: true });
  }
}

function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    stdio: ["ignore", "ignore", "inherit"],
  });
  if (result.signal !== null) {
    throw new Error(`\`${command} ${args.join(" ")}\` was stopped (${result.signal})`);
  }
  if (result.status !== 0) {
    throw new Error(
      `\`${command} ${args.join(" ")}\` failed in ${cwd} (exit ${result.status}) - see its output above`,
    );
  }
}
