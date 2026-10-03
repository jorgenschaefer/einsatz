import assert from "node:assert/strict";
import { test } from "node:test";
import { findCoverageDrops, findNewFiles } from "./compare-coverage.mjs";

const root = "/repo";

function entry(lines, branches) {
  return {
    lines: { covered: lines[0], total: lines[1] },
    branches: { covered: branches[0], total: branches[1] },
  };
}

test("an unchanged file is not named", () => {
  const drops = findCoverageDrops({
    baseline: { "src/a.ts": entry([3, 4], [1, 2]) },
    splits: {},
    current: { "/repo/src/a.ts": entry([3, 4], [1, 2]) },
    repoRoot: root,
  });
  assert.deepEqual(drops, []);
});

test("a file whose share of covered lines dropped is named", () => {
  const drops = findCoverageDrops({
    baseline: { "src/a.ts": entry([3, 4], [1, 2]) },
    splits: {},
    current: { "/repo/src/a.ts": entry([3, 5], [1, 2]) },
    repoRoot: root,
  });
  assert.deepEqual(drops, ["src/a.ts: lines 75.00% (3/4) → 60.00% (3/5)"]);
});

test("a file whose share of covered branches dropped is named", () => {
  const drops = findCoverageDrops({
    baseline: { "src/a.ts": entry([3, 4], [2, 2]) },
    splits: {},
    current: { "/repo/src/a.ts": entry([3, 4], [1, 2]) },
    repoRoot: root,
  });
  assert.deepEqual(drops, [
    "src/a.ts: branches 100.00% (2/2) → 50.00% (1/2)",
  ]);
});

test("a higher share with fewer covered lines is no drop", () => {
  const drops = findCoverageDrops({
    baseline: { "src/a.ts": entry([3, 4], [0, 0]) },
    splits: {},
    current: { "/repo/src/a.ts": entry([2, 2], [0, 0]) },
    repoRoot: root,
  });
  assert.deepEqual(drops, []);
});

test("a file without branches counts as fully covered", () => {
  const drops = findCoverageDrops({
    baseline: { "src/a.ts": entry([1, 1], [0, 0]) },
    splits: {},
    current: { "/repo/src/a.ts": entry([1, 1], [1, 2]) },
    repoRoot: root,
  });
  assert.deepEqual(drops, ["src/a.ts: branches 100.00% (0/0) → 50.00% (1/2)"]);
});

test("a split file is compared as the sum of its parts", () => {
  const splits = { "src/a.ts": ["src/a.ts", "src/b.ts"] };
  const baseline = { "src/a.ts": entry([6, 8], [2, 4]) };
  const kept = findCoverageDrops({
    baseline,
    splits,
    current: {
      "/repo/src/a.ts": entry([3, 4], [2, 2]),
      "/repo/src/b.ts": entry([3, 4], [0, 2]),
    },
    repoRoot: root,
  });
  const dropped = findCoverageDrops({
    baseline,
    splits,
    current: {
      "/repo/src/a.ts": entry([3, 4], [2, 2]),
      "/repo/src/b.ts": entry([2, 4], [0, 2]),
    },
    repoRoot: root,
  });
  assert.deepEqual(kept, []);
  assert.deepEqual(dropped, ["src/a.ts: lines 75.00% (6/8) → 62.50% (5/8)"]);
});

test("a file listed as deleted is skipped", () => {
  const drops = findCoverageDrops({
    baseline: { "src/a.ts": entry([3, 4], [1, 2]) },
    splits: { "src/a.ts": [] },
    current: {},
    repoRoot: root,
  });
  assert.deepEqual(drops, []);
});

test("a file missing from the measurement and not listed is named", () => {
  const drops = findCoverageDrops({
    baseline: { "src/a.ts": entry([3, 4], [1, 2]) },
    splits: {},
    current: {},
    repoRoot: root,
  });
  assert.deepEqual(drops, [
    "src/a.ts: not in the measurement - if it was split, moved or deleted, list it in coverage-splits.json",
  ]);
});

test("a split file whose parts are all missing is named", () => {
  const drops = findCoverageDrops({
    baseline: { "src/a.ts": entry([3, 4], [1, 2]) },
    splits: { "src/a.ts": ["src/b.ts", "src/c.ts"] },
    current: {},
    repoRoot: root,
  });
  assert.deepEqual(drops, [
    "src/a.ts: none of its parts src/b.ts, src/c.ts is in the measurement - fix its entry in coverage-splits.json",
  ]);
});

test("a split file with one part missing is named", () => {
  const drops = findCoverageDrops({
    baseline: { "src/a.ts": entry([3, 4], [1, 2]) },
    splits: { "src/a.ts": ["src/a.ts", "src/c.ts"] },
    current: { "/repo/src/a.ts": entry([3, 4], [1, 2]) },
    repoRoot: root,
  });
  assert.deepEqual(drops, [
    "src/a.ts: its part src/c.ts is not in the measurement - fix its entry in coverage-splits.json",
  ]);
});

test("a measured file that is neither in the baseline nor a listed part is new, not a drop", () => {
  const coverage = {
    baseline: { total: entry([3, 4], [1, 2]), "src/a.ts": entry([3, 4], [1, 2]) },
    splits: { "src/a.ts": ["src/a.ts", "src/c.ts"] },
    current: {
      total: entry([3, 8], [1, 4]),
      "/repo/src/a.ts": entry([3, 4], [1, 2]),
      "/repo/src/b.ts": entry([0, 4], [0, 2]),
      "/repo/src/c.ts": entry([0, 0], [0, 0]),
    },
    repoRoot: root,
  };
  assert.deepEqual(findCoverageDrops(coverage), []);
  assert.deepEqual(findNewFiles(coverage), ["src/b.ts"]);
});

test("a split entry for a file not in the baseline is named", () => {
  const drops = findCoverageDrops({
    baseline: { "src/a.ts": entry([3, 4], [1, 2]) },
    splits: { "src/a.tsx": ["src/a.ts"] },
    current: { "/repo/src/a.ts": entry([3, 4], [1, 2]) },
    repoRoot: root,
  });
  assert.deepEqual(drops, [
    "src/a.tsx: listed in coverage-splits.json but not in the baseline - use the path the baseline has",
  ]);
});

test("a split entry that is not a list of paths is named", () => {
  const drops = findCoverageDrops({
    baseline: { "src/a.ts": entry([3, 4], [1, 2]) },
    splits: { "src/a.ts": "src/b.ts" },
    current: { "/repo/src/b.ts": entry([3, 4], [1, 2]) },
    repoRoot: root,
  });
  assert.deepEqual(drops, [
    'src/a.ts: its entry in coverage-splits.json is "src/b.ts" - it must be a list of paths, such as ["src/b.ts"]',
  ]);
});

test("the total entry is not a file", () => {
  const drops = findCoverageDrops({
    baseline: { total: entry([3, 4], [1, 2]) },
    splits: {},
    current: { total: entry([1, 4], [1, 2]) },
    repoRoot: root,
  });
  assert.deepEqual(drops, []);
});
