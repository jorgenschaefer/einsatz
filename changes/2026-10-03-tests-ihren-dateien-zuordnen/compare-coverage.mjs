// Compares coverage/coverage-summary.json (from `npm run test:coverage`) with
// coverage-baseline.json and names every source file whose share of covered
// lines or branches dropped (AC-10). Files split, moved or deleted are listed
// in coverage-splits.json. Exits 1 when a file dropped or a listing is wrong;
// files new since the start commit are named but do not fail it.
//
//   node changes/2026-10-03-tests-ihren-dateien-zuordnen/compare-coverage.mjs

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const changeDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(changeDir, "../..");
const summaryPath = path.join(repoRoot, "coverage/coverage-summary.json");

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}

function main() {
  if (!existsSync(summaryPath)) {
    console.error(
      `${summaryPath} does not exist - run \`npm run test:coverage\` first`,
    );
    process.exit(2);
  }
  const coverage = {
    baseline: readJson(path.join(changeDir, "coverage-baseline.json")),
    splits: readJson(path.join(changeDir, "coverage-splits.json")),
    current: readJson(summaryPath),
    repoRoot,
  };
  const drops = findCoverageDrops(coverage);
  for (const drop of drops) console.log(drop);
  for (const file of findNewFiles(coverage)) {
    console.log(
      `${file}: new, compared with nothing - if it was split out of a baseline file, list it among that file's parts in coverage-splits.json`,
    );
  }
  process.exit(drops.length > 0 ? 1 : 0);
}

export function findCoverageDrops({ baseline, splits, current, repoRoot }) {
  const measured = withRelativeKeys(current, repoRoot);
  const drops = [];
  for (const [file, before] of Object.entries(baseline)) {
    if (file === "total") continue;
    const parts = splits[file] ?? [file];
    if (!Array.isArray(parts)) {
      drops.push(
        `${file}: its entry in coverage-splits.json is ${JSON.stringify(parts)} - it must be a list of paths, such as ${JSON.stringify([parts])}`,
      );
      continue;
    }
    if (parts.length === 0) continue;
    const missing = parts.filter((part) => !(part in measured));
    if (missing.length > 0) {
      drops.push(describeMissing(file, parts, missing, file in splits));
      continue;
    }
    const after = addUp(parts.map((part) => measured[part]));
    for (const metric of ["lines", "branches"]) {
      if (isLowerShare(after[metric], before[metric])) {
        drops.push(
          `${file}: ${metric} ${share(before[metric])} → ${share(after[metric])}`,
        );
      }
    }
  }
  for (const file of Object.keys(splits)) {
    if (!(file in baseline)) {
      drops.push(
        `${file}: listed in coverage-splits.json but not in the baseline - use the path the baseline has`,
      );
    }
  }
  return drops;
}

// Files the start commit did not have: AC-10 has nothing to compare them
// with, but a split nobody listed shows up here too.
export function findNewFiles({ baseline, splits, current, repoRoot }) {
  const parts = new Set(Object.values(splits).flat());
  return Object.keys(withRelativeKeys(current, repoRoot)).filter(
    (file) => !(file in baseline) && !parts.has(file),
  );
}

export function withRelativeKeys(summary, repoRoot) {
  return Object.fromEntries(
    Object.entries(summary).map(([key, value]) => [
      path.isAbsolute(key) ? path.relative(repoRoot, key) : key,
      value,
    ]),
  );
}

function describeMissing(file, parts, missing, isListed) {
  if (!isListed) {
    return `${file}: not in the measurement - if it was split, moved or deleted, list it in coverage-splits.json`;
  }
  if (missing.length === parts.length) {
    return `${file}: none of its parts ${parts.join(", ")} is in the measurement - fix its entry in coverage-splits.json`;
  }
  return `${file}: its part ${missing.join(", ")} is not in the measurement - fix its entry in coverage-splits.json`;
}

function addUp(entries) {
  const sum = (metric, field) =>
    entries.reduce((total, entry) => total + entry[metric][field], 0);
  return {
    lines: { covered: sum("lines", "covered"), total: sum("lines", "total") },
    branches: {
      covered: sum("branches", "covered"),
      total: sum("branches", "total"),
    },
  };
}

// Nothing to cover counts as fully covered, as in the summary's `pct`.
function isLowerShare(after, before) {
  const [a, b] = [asFraction(after), asFraction(before)];
  return a.covered * b.total < b.covered * a.total;
}

function asFraction({ covered, total }) {
  return total === 0 ? { covered: 1, total: 1 } : { covered, total };
}

function share({ covered, total }) {
  const { covered: c, total: t } = asFraction({ covered, total });
  return `${((100 * c) / t).toFixed(2)}% (${covered}/${total})`;
}

function readJson(file) {
  return JSON.parse(readFileSync(file, "utf8"));
}
