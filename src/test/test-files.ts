import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { isServerActionModule } from "./server-action-modules";

/**
 * The rule of the test layout, checked over `files` (the paths
 * {@link repositoryFiles} lists) and `read` (a file's content): every test
 * file has a source file of the same name beside it, and no source file has
 * two; every server action module, route handler and page under `src/app/`
 * has a test file that calls the shared checks its kind requires. Returns one
 * message per violation, each naming the file at fault and the fix.
 */
export function checkTestFiles(
  files: string[],
  read: (file: string) => string,
): string[] {
  const listed = new Set(files);
  return [
    ...files
      .filter(isTestFile)
      .flatMap((test) => testFileWithoutSource(test, listed)),
    ...files
      .filter((file) => !isTestFile(file))
      .flatMap((source) => sourceWithTwoTestFiles(source, listed)),
    ...files
      .filter((file) => !isTestFile(file))
      .flatMap((source) => entryPointWithoutChecks(source, listed, read)),
  ];
}

/**
 * The files of the git repository in `dir`, relative to it: tracked ones and
 * new ones not yet added, so a file is checked before its first commit;
 * ignored and deleted ones are left out.
 */
export function repositoryFiles(dir: string): string[] {
  return execFileSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard"],
    { cwd: dir, encoding: "utf8" },
  )
    .split("\n")
    .filter((file) => file !== "" && existsSync(join(dir, file)));
}

const TEST_FILE = /^(.*)\.test\.(tsx?|mjs)$/;

/** The source extensions a test file of each extension may test. */
const SOURCE_EXTENSIONS: Record<string, string[]> = {
  ts: ["ts", "tsx"],
  tsx: ["ts", "tsx"],
  mjs: ["mjs"],
};

function isTestFile(file: string): boolean {
  return TEST_FILE.test(file);
}

function testFileWithoutSource(test: string, listed: Set<string>): string[] {
  const [, stem, extension] = TEST_FILE.exec(test) as RegExpExecArray;
  const extensions = SOURCE_EXTENSIONS[extension];
  if (extensions.some((source) => listed.has(`${stem}.${source}`))) return [];

  const missing = extensions
    .map((source) => `${basename(stem)}.${source}`)
    .join(" or ");
  return [
    `${test}: no source file ${missing} beside it - move each test into the test file of the source file whose behaviour it tests${example(stem, extension, listed)}`,
  ];
}

function sourceWithTwoTestFiles(source: string, listed: Set<string>): string[] {
  const tests = testFilesOf(source, listed);
  if (tests.length < 2) return [];

  const sameExtension = source.replace(/\.(\w+)$/, ".test.$1");
  const keep = tests.includes(sameExtension) ? sameExtension : tests[0];
  const merge = tests.filter((test) => test !== keep).join(" and ");
  return [
    `${source}: two test files, ${tests.join(" and ")} - merge ${merge} into ${keep}`,
  ];
}

/** The listed test files beside `source` that are named after it. */
function testFilesOf(source: string, listed: Set<string>): string[] {
  const match = /^(.*)\.(tsx?|mjs)$/.exec(source);
  if (!match) return [];
  const [, stem, extension] = match;
  return SOURCE_EXTENSIONS[extension]
    .map((ext) => `${stem}.test.${ext}`)
    .filter((test) => listed.has(test));
}

/**
 * For a topic test file `Foo.bar.test.tsx`, the nearest source of a shorter
 * name (`Foo.tsx`) and the test file its tests would move into.
 */
function example(stem: string, extension: string, listed: Set<string>): string {
  const dir = dirname(stem);
  const parts = basename(stem).split(".");
  for (let n = parts.length - 1; n > 0; n--) {
    const shorter = join(dir, parts.slice(0, n).join("."));
    const source = SOURCE_EXTENSIONS[extension]
      .map((ext) => `${shorter}.${ext}`)
      .find((file) => listed.has(file));
    if (!source) continue;
    const test =
      testFilesOf(source, listed)[0] ?? `${shorter}.test.${extension}`;
    return `, such as ${test} for ${source}`;
  }
  return "";
}

/** The shared checks of one kind of entry point: each entry calls one of its helpers. */
interface RequiredChecks {
  definedIn: string;
  helpers: string[][];
  /** The area that refuses a page declared public with `expectPublicPage`. */
  publicRefusedIn?: string;
}

function entryPointWithoutChecks(
  source: string,
  listed: Set<string>,
  read: (file: string) => string,
): string[] {
  const required = requiredChecks(source, read);
  if (!required) return [];

  const test = testFilesOf(source, listed)[0];
  if (!test) {
    const calling = required.helpers.map((h) => h.join(" or ")).join(" and ");
    return [
      `${source}: no test file - create ${source.replace(/\.(\w+)$/, ".test.$1")} calling ${calling} (${required.definedIn})`,
    ];
  }

  const content = read(test);
  const missing = required.helpers
    .filter((anyOf) => !anyOf.some((helper) => calls(content, helper)))
    .map(
      (anyOf) =>
        `${source}: its test file ${test} does not call ${anyOf.join(" or ")} (${required.definedIn})`,
    );
  const area = required.publicRefusedIn;
  if (!area || !calls(content, "expectPublicPage")) return missing;
  return [
    ...missing,
    `${source}: its test file ${test} declares the page public with expectPublicPage, but a page under ${area} cannot be public - remove that call (${required.definedIn})`,
  ];
}

function requiredChecks(
  source: string,
  read: (file: string) => string,
): RequiredChecks | undefined {
  if (!source.startsWith("src/app/")) return undefined;
  if (basename(source) === "route.ts") return routeChecks(source, read(source));
  if (basename(source) === "page.tsx") return pageChecks(source);
  if (/\.tsx?$/.test(source) && isServerActionModule(read(source))) {
    return actionChecks(source);
  }
  return undefined;
}

function actionChecks(source: string): RequiredChecks {
  const helpers = [
    ["expectEveryActionRequiresLogin"],
    ["expectBadCallsRejected"],
  ];
  if (source.startsWith("src/app/operations/[id]/")) {
    helpers.push(["expectForeignObjectsRejected"]);
  }
  return { definedIn: "src/test/action-checks.ts", helpers };
}

function routeChecks(source: string, content: string): RequiredChecks {
  const helpers = [
    [
      tokenArea(source)
        ? "expectRouteRequiresToken"
        : "expectRouteRequiresLogin",
    ],
  ];
  if (hasObjectIdInPath(source)) helpers.push(["expectNonUuidObjectIdRefused"]);
  if (source.startsWith("src/app/operations/") && acceptsUploads(content)) {
    helpers.push(["expectUploadRules"]);
  }
  return { definedIn: "src/test/route-checks.ts", helpers };
}

function pageChecks(source: string): RequiredChecks {
  const definedIn = "src/test/page-checks.ts";
  const linkArea = tokenArea(source);
  if (linkArea) {
    return {
      definedIn,
      helpers: [["expectPageRequiresToken"]],
      publicRefusedIn: linkArea,
    };
  }
  if (source.startsWith(ADMIN_AREA)) {
    return {
      definedIn,
      helpers: [["expectPageRequiresAdmin"]],
      publicRefusedIn: ADMIN_AREA,
    };
  }
  return {
    definedIn,
    helpers: [["expectPageRequiresLogin", "expectPublicPage"]],
  };
}

const ADMIN_AREA = "src/app/admin/";

/** The area under `src/app/` whose routes and pages are opened by a link token. */
function tokenArea(source: string): string | undefined {
  return ["src/app/view/", "src/app/device/"].find((area) =>
    source.startsWith(area),
  );
}

/** A dynamic segment other than the Einsatz-ID and the link token. */
function hasObjectIdInPath(source: string): boolean {
  return source
    .split("/")
    .some(
      (segment) =>
        /^\[.+\]$/.test(segment) && !["[id]", "[token]"].includes(segment),
    );
}

/** Whether the route exports `POST` or `PUT`, declared or re-exported. */
function acceptsUploads(route: string): boolean {
  return (
    /export\s+(?:async\s+)?(?:function|const|let)\s+(?:POST|PUT)\b/.test(
      route,
    ) || /export\s*\{[^}]*\b(?:POST|PUT)\b[^}]*\}/.test(route)
  );
}

function calls(content: string, helper: string): boolean {
  return new RegExp(`\\b${helper}\\(`).test(content);
}
