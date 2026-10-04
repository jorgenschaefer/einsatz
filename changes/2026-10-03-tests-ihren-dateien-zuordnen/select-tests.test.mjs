import assert from "node:assert/strict";
import { test } from "node:test";
import { selectTests } from "./select-tests.mjs";

function select(files, { include = ["src/**"], exclude = [], reviewed = [] } = {}) {
  return selectTests({
    testFiles: Object.keys(files).filter((file) => file.includes(".test.")),
    include,
    exclude,
    reviewed,
    read: (file) => files[file],
  });
}

test("a test that imports only its own file is not selected", () => {
  const files = {
    "src/a/Foo.tsx": "export function Foo() {}\n",
    "src/a/Foo.test.tsx": 'import { Foo } from "./Foo";\n',
  };
  assert.deepEqual(select(files), []);
});

test("a test that imports another project module is selected", () => {
  const files = {
    "src/a/Foo.tsx": "",
    "src/a/Bar.ts": "",
    "src/a/Foo.test.tsx": 'import { Foo } from "./Foo";\nimport { bar } from "./Bar";\n',
  };
  assert.deepEqual(select(files), ["src/a/Foo.test.tsx"]);
});

test("a test whose own file imports another project module is selected", () => {
  const files = {
    "src/a/Foo.tsx": 'import { bar } from "@/b/bar";\n',
    "src/b/bar.ts": "",
    "src/a/Foo.test.tsx": 'import { Foo } from "./Foo";\n',
  };
  assert.deepEqual(select(files), ["src/a/Foo.test.tsx"]);
});

test("packages are not project modules", () => {
  const files = {
    "src/a/Foo.tsx": 'import { Button } from "@mantine/core";\nimport L from "leaflet";\n',
    "src/a/Foo.test.tsx": 'import { render } from "@testing-library/react";\nimport { Foo } from "./Foo";\n',
  };
  assert.deepEqual(select(files), []);
});

test("type-only imports do not reach another file", () => {
  const files = {
    "src/a/Foo.tsx": 'import type { Bar } from "./Bar";\nimport { type Baz } from "./Baz";\n',
    "src/a/Bar.ts": "",
    "src/a/Baz.ts": "",
    "src/a/Foo.test.tsx": 'import { Foo } from "./Foo";\n',
  };
  assert.deepEqual(select(files), []);
});

test("an import with a type and a value reaches the other file", () => {
  const files = {
    "src/a/Foo.tsx": 'import { type Baz, baz } from "./Baz";\n',
    "src/a/Baz.ts": "",
    "src/a/Foo.test.tsx": 'import { Foo } from "./Foo";\n',
  };
  assert.deepEqual(select(files), ["src/a/Foo.test.tsx"]);
});

for (const [kind, source] of [
  ["a multi-line import", 'import {\n  bar,\n  baz,\n} from "./Bar";\n'],
  ["a re-export", 'export { bar } from "./Bar";\n'],
  ["a side-effect import", 'import "./Bar";\n'],
  ["a dynamic import", 'const m = await import(\n  "./Bar"\n);\n'],
  ["an index module", 'import { bar } from "./bar-dir";\n'],
]) {
  test(`${kind} reaches the other file`, () => {
    const files = {
      "src/a/Foo.ts": source,
      "src/a/Bar.ts": "",
      "src/a/bar-dir/index.ts": "",
      "src/a/Foo.test.ts": 'import { foo } from "./Foo";\n',
    };
    assert.deepEqual(select(files), ["src/a/Foo.test.ts"]);
  });
}

test("an import that resolves to no file is not a project module", () => {
  const files = {
    "src/a/Foo.ts": 'import { bar } from "./missing";\n',
    "src/a/Foo.test.ts": 'import { foo } from "./Foo";\n',
  };
  assert.deepEqual(select(files), []);
});

test("a fixture that imports nothing else is not a reason", () => {
  const files = {
    "src/a/Foo.tsx": "",
    "src/a/Foo.fixtures.tsx": 'import { Foo } from "./Foo";\nexport const props = {};\n',
    "src/a/Foo.test.tsx": 'import { props } from "./Foo.fixtures";\n',
  };
  assert.deepEqual(select(files), []);
});

test("a fixture that imports another module selects the test", () => {
  const files = {
    "src/a/Foo.tsx": "",
    "src/a/Bar.tsx": "",
    "src/a/Foo.fixtures.tsx": 'import { Bar } from "./Bar";\n',
    "src/a/Foo.test.tsx": 'import { props } from "./Foo.fixtures";\n',
  };
  assert.deepEqual(select(files), ["src/a/Foo.test.tsx"]);
});

test("a src/test file that imports another module selects the test", () => {
  const files = {
    "src/a/Foo.ts": "",
    "src/server/db/migrate.ts": "",
    "src/test/db.ts": 'import { migrate } from "@/server/db/migrate";\n',
    "src/a/Foo.test.ts": 'import { freshDb } from "@/test/db";\n',
  };
  assert.deepEqual(select(files), ["src/a/Foo.test.ts"]);
});

test("the providers src/test/render.tsx wraps a component in are no reason", () => {
  const files = {
    "src/a/Foo.tsx": "",
    "src/app/theme.ts": "",
    "src/app/ActionNotifications.tsx": "",
    "src/test/render.tsx":
      'import { ActionNotifications } from "@/app/ActionNotifications";\nimport { theme } from "@/app/theme";\n',
    "src/a/Foo.test.tsx": 'import { render } from "@/test/render";\n',
  };
  assert.deepEqual(select(files), []);
});

test("the look into fixtures goes one level deep", () => {
  const files = {
    "src/a/Foo.tsx": "",
    "src/a/Bar.tsx": "",
    "src/a/Foo.fixtures.ts": 'import { other } from "./other.fixtures";\n',
    "src/a/other.fixtures.ts": 'import { Bar } from "./Bar";\n',
    "src/a/Foo.test.tsx": 'import { props } from "./Foo.fixtures";\n',
  };
  assert.deepEqual(select(files), []);
});

test("reading another project file at run time selects the test", () => {
  const files = {
    "src/a/sizes.ts": "",
    "src/a/look.css": "",
    "src/a/sizes.test.ts":
      'import { readFileSync } from "node:fs";\nconst css = readFileSync(\n  "src/a/look.css",\n  "utf8",\n);\n',
  };
  assert.deepEqual(select(files), ["src/a/sizes.test.ts"]);
});

test("reading a file relative to the test selects it too", () => {
  const files = {
    "src/a/sizes.ts": "",
    "src/a/look.css": "",
    "src/a/sizes.test.ts":
      'const css = await readFile(new URL("./look.css", import.meta.url), "utf8");\n',
  };
  assert.deepEqual(select(files), ["src/a/sizes.test.ts"]);
});

test("a ?raw import reaches the file", () => {
  const files = {
    "src/a/sizes.ts": "",
    "src/a/look.css": "",
    "src/a/sizes.test.ts": 'import css from "./look.css?raw";\n',
  };
  assert.deepEqual(select(files), ["src/a/sizes.test.ts"]);
});

test("a test listed as reviewed is skipped", () => {
  const files = {
    "src/a/Foo.tsx": 'import { Bar } from "./Bar";\n',
    "src/a/Bar.tsx": "",
    "src/a/Foo.test.tsx": 'import { Foo } from "./Foo";\n',
  };
  assert.deepEqual(select(files, { reviewed: ["src/a/Foo.test.tsx"] }), []);
});

test("only included and not excluded test files are selected", () => {
  const files = {
    "src/a/Bar.ts": "",
    "src/a/Foo.tsx": 'import "./Bar";\n',
    "src/a/Foo.test.tsx": "",
    "src/a/Baz.tsx": 'import "./Bar";\n',
    "src/a/Baz.test.tsx": "",
    "src/b/Qux.tsx": 'import "@/a/Bar";\n',
    "src/b/Qux.test.tsx": "",
  };
  assert.deepEqual(
    select(files, { include: ["src/a/*.test.tsx"], exclude: ["src/a/Baz.test.tsx"] }),
    ["src/a/Foo.test.tsx"],
  );
});

test("a .test.tsx file pairs with a .ts source", () => {
  const files = {
    "src/a/useFoo.ts": "",
    "src/a/useFoo.test.tsx": 'import { useFoo } from "./useFoo";\n',
  };
  assert.deepEqual(select(files), []);
});
