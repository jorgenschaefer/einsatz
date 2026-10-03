import assert from "node:assert/strict";
import { test } from "node:test";
import { compareTestLists, formatComparison } from "./removed-tests.mjs";

const root = "/repo";

function listed(file, name) {
  return { file: `/repo/${file}`, name, projectName: "node" };
}

test("the same tests give nothing removed and nothing added", () => {
  const tests = [listed("src/a.test.ts", "a > works")];
  assert.deepEqual(compareTestLists(tests, root, tests, root), {
    removed: [],
    added: [],
  });
});

test("a renamed test is removed under its old name and added under its new", () => {
  const before = [listed("src/a.test.ts", "a > works")];
  const after = [listed("src/a.test.ts", "a > still works")];
  assert.deepEqual(compareTestLists(before, root, after, root), {
    removed: ["src/a.test.ts › a › works"],
    added: ["src/a.test.ts › a › still works"],
  });
});

test("a test moved to another file is removed from the old file", () => {
  const before = [listed("src/a.test.ts", "a > works")];
  const after = [listed("src/b.test.ts", "a > works")];
  assert.deepEqual(compareTestLists(before, root, after, root), {
    removed: ["src/a.test.ts › a › works"],
    added: ["src/b.test.ts › a › works"],
  });
});

test("one of two tests with the same name is removed", () => {
  const twice = [
    listed("src/a.test.ts", "a > works"),
    listed("src/a.test.ts", "a > works"),
  ];
  const once = [listed("src/a.test.ts", "a > works")];
  assert.deepEqual(compareTestLists(twice, root, once, root), {
    removed: ["src/a.test.ts › a › works"],
    added: [],
  });
});

test("both of two tests with the same name are removed", () => {
  const twice = [
    listed("src/a.test.ts", "a > works"),
    listed("src/a.test.ts", "a > works"),
  ];
  assert.deepEqual(compareTestLists(twice, root, [], root), {
    removed: ["src/a.test.ts › a › works", "src/a.test.ts › a › works"],
    added: [],
  });
});

test("the two lists may come from different checkouts", () => {
  const before = [{ file: "/tmp/wt/src/a.test.ts", name: "works" }];
  const after = [listed("src/a.test.ts", "works")];
  assert.deepEqual(compareTestLists(before, "/tmp/wt", after, root), {
    removed: [],
    added: [],
  });
});

test("nothing to report prints nothing", () => {
  assert.equal(formatComparison({ removed: [], added: [] }), "");
});

test("removed tests print as the record's lines, added tests below", () => {
  assert.equal(
    formatComparison({
      removed: ["src/a.test.ts › a › works"],
      added: ["src/b.test.ts › a › works", "src/b.test.ts › b"],
    }),
    [
      "Removed tests:",
      "- src/a.test.ts › a › works",
      "",
      "Added tests:",
      "+ src/b.test.ts › a › works",
      "+ src/b.test.ts › b",
      "",
    ].join("\n"),
  );
});
