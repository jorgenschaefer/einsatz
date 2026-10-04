import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { checkTestFiles } from "./test-files";

/** Checks a tree given as path → content; a file absent from it is not tracked. */
function check(tree: Record<string, string>): string[] {
  return checkTestFiles(Object.keys(tree), (file) => tree[file]);
}

describe("the repository", () => {
  it("keeps the rule: every test file pairs with its source, and every entry point runs its checks", () => {
    const files = execFileSync("git", ["ls-files"], { encoding: "utf8" })
      .split("\n")
      .filter((file) => file !== "" && existsSync(file));

    expect(checkTestFiles(files, (file) => readFileSync(file, "utf8"))).toEqual(
      [],
    );
  });
});

describe("checkTestFiles: one test file per source file", () => {
  it("moves a topic test file into the test file of its source", () => {
    expect(
      check({
        "src/map/Foo.tsx": "",
        "src/map/Foo.bar.test.tsx": "",
      }),
    ).toEqual([
      "src/map/Foo.bar.test.tsx: no source file Foo.bar.ts or Foo.bar.tsx beside it - move each test into the test file of the source file whose behaviour it tests, such as src/map/Foo.test.tsx for src/map/Foo.tsx",
    ]);
  });

  it("names the existing test file of the source to move into", () => {
    expect(
      check({
        "src/map/Panel.tsx": "",
        "src/map/Panel.test.ts": "",
        "src/map/Panel.redirect.test.tsx": "",
      }),
    ).toEqual([
      "src/map/Panel.redirect.test.tsx: no source file Panel.redirect.ts or Panel.redirect.tsx beside it - move each test into the test file of the source file whose behaviour it tests, such as src/map/Panel.test.ts for src/map/Panel.tsx",
    ]);
  });

  it("names the test file to move into at the repository root", () => {
    expect(
      check({
        "next.config.ts": "",
        "next.config.test.ts": "",
        "next.config.headers.test.ts": "",
      }),
    ).toEqual([
      "next.config.headers.test.ts: no source file next.config.headers.ts or next.config.headers.tsx beside it - move each test into the test file of the source file whose behaviour it tests, such as next.config.test.ts for next.config.ts",
    ]);
  });

  it("refuses a test file with no source of any shorter name", () => {
    expect(check({ "src/journal/flows.test.ts": "" })).toEqual([
      "src/journal/flows.test.ts: no source file flows.ts or flows.tsx beside it - move each test into the test file of the source file whose behaviour it tests",
    ]);
  });

  it("accepts a test file beside its source, whatever the two extensions", () => {
    expect(
      check({
        "src/map/Panel.tsx": "",
        "src/map/Panel.test.ts": "",
        "next.config.ts": "",
        "next.config.test.ts": "",
        "changes/x/compare.mjs": "",
        "changes/x/compare.test.mjs": "",
      }),
    ).toEqual([]);
  });

  it("refuses two test files for one source", () => {
    expect(
      check({
        "src/map/Foo.tsx": "",
        "src/map/Foo.test.ts": "",
        "src/map/Foo.test.tsx": "",
      }),
    ).toEqual([
      "src/map/Foo.tsx: two test files, src/map/Foo.test.ts and src/map/Foo.test.tsx - merge src/map/Foo.test.ts into src/map/Foo.test.tsx",
    ]);
  });
});

const USE_SERVER = '"use server";\nexport async function a() {}';
const ACTION_CHECKS = "src/test/action-checks.ts";
const ROUTE_CHECKS = "src/test/route-checks.ts";
const PAGE_CHECKS = "src/test/page-checks.ts";

describe("checkTestFiles: server action modules", () => {
  it("requires a test file", () => {
    expect(check({ "src/app/x/actions.ts": USE_SERVER })).toEqual([
      `src/app/x/actions.ts: no test file - create src/app/x/actions.test.ts calling expectEveryActionRequiresLogin and expectBadCallsRejected (${ACTION_CHECKS})`,
    ]);
  });

  it("requires the login and bad-call checks", () => {
    expect(
      check({
        "src/app/x/actions.ts": USE_SERVER,
        "src/app/x/actions.test.ts":
          "import { expectBadCallsRejected } from '@/test/action-checks';\nexpectEveryActionRequiresLogin(actions, { actAs });",
      }),
    ).toEqual([
      `src/app/x/actions.ts: its test file src/app/x/actions.test.ts does not call expectBadCallsRejected (${ACTION_CHECKS})`,
    ]);
  });

  it("requires the check of foreign objects under operations/[id]/", () => {
    expect(
      check({
        "src/app/operations/[id]/actions.ts": USE_SERVER,
        "src/app/operations/[id]/actions.test.ts":
          "expectEveryActionRequiresLogin(a);\nexpectBadCallsRejected(a);",
      }),
    ).toEqual([
      `src/app/operations/[id]/actions.ts: its test file src/app/operations/[id]/actions.test.ts does not call expectForeignObjectsRejected (${ACTION_CHECKS})`,
    ]);
  });

  it("finds the directive behind comments, and leaves other modules alone", () => {
    expect(
      check({
        "src/app/x/commented.ts": `// Aktionen\n${USE_SERVER}`,
        "src/app/x/late.ts": 'import x from "y";\n"use server";',
        "src/app/x/Form.tsx": '"use client";',
        "src/server/actions.ts": USE_SERVER,
        "src/app/x/notes.md": USE_SERVER,
        "src/app/x/helper.ts": "",
        "src/app/x/helper.test.ts": USE_SERVER,
      }),
    ).toEqual([
      `src/app/x/commented.ts: no test file - create src/app/x/commented.test.ts calling expectEveryActionRequiresLogin and expectBadCallsRejected (${ACTION_CHECKS})`,
    ]);
  });
});

describe("checkTestFiles: route handlers", () => {
  it("requires a test file", () => {
    expect(
      check({ "src/app/x/route.ts": "export async function GET() {}" }),
    ).toEqual([
      `src/app/x/route.ts: no test file - create src/app/x/route.test.ts calling expectRouteRequiresLogin (${ROUTE_CHECKS})`,
    ]);
  });

  it("requires the token check under device/ and view/, not the login", () => {
    expect(
      check({
        "src/app/device/[token]/geocode/route.ts":
          "export async function GET() {}",
        "src/app/device/[token]/geocode/route.test.ts":
          "expectRouteRequiresLogin(route, {});",
        "src/app/view/[token]/geocode/route.ts":
          "export async function GET() {}",
        "src/app/view/[token]/geocode/route.test.ts":
          "expectRouteRequiresToken(route, {});",
      }),
    ).toEqual([
      `src/app/device/[token]/geocode/route.ts: its test file src/app/device/[token]/geocode/route.test.ts does not call expectRouteRequiresToken (${ROUTE_CHECKS})`,
    ]);
  });

  it("requires the non-UUID check for an object id in the path", () => {
    expect(
      check({
        "src/app/view/[token]/overlays/[overlayId]/route.ts":
          "export async function GET() {}",
        "src/app/view/[token]/overlays/[overlayId]/route.test.ts":
          "expectRouteRequiresToken(route, {});",
      }),
    ).toEqual([
      `src/app/view/[token]/overlays/[overlayId]/route.ts: its test file src/app/view/[token]/overlays/[overlayId]/route.test.ts does not call expectNonUuidObjectIdRefused (${ROUTE_CHECKS})`,
    ]);
  });

  it("requires the upload rules for POST and PUT under operations/", () => {
    expect(
      check({
        "src/app/operations/[id]/kml/route.ts":
          "export async function POST() {}",
        "src/app/operations/[id]/kml/route.test.ts":
          "expectRouteRequiresLogin(route, {});",
        "src/app/operations/[id]/up/route.ts": "export const PUT = handle;",
        "src/app/operations/[id]/up/route.test.ts":
          "expectRouteRequiresLogin(route, {});",
        "src/app/operations/[id]/sync/route.ts": "export function POST() {}",
        "src/app/operations/[id]/sync/route.test.ts":
          "expectRouteRequiresLogin(route, {});",
        "src/app/operations/[id]/alias/route.ts": "export { handle as PUT };",
        "src/app/operations/[id]/alias/route.test.ts":
          "expectRouteRequiresLogin(route, {});",
        "src/app/operations/[id]/events/route.ts":
          "export async function GET() {}",
        "src/app/operations/[id]/events/route.test.ts":
          "expectRouteRequiresLogin(route, {});",
        "src/app/device/[token]/position/route.ts":
          "export async function POST() {}",
        "src/app/device/[token]/position/route.test.ts":
          "expectRouteRequiresToken(route, {});",
      }),
    ).toEqual([
      `src/app/operations/[id]/kml/route.ts: its test file src/app/operations/[id]/kml/route.test.ts does not call expectUploadRules (${ROUTE_CHECKS})`,
      `src/app/operations/[id]/up/route.ts: its test file src/app/operations/[id]/up/route.test.ts does not call expectUploadRules (${ROUTE_CHECKS})`,
      `src/app/operations/[id]/sync/route.ts: its test file src/app/operations/[id]/sync/route.test.ts does not call expectUploadRules (${ROUTE_CHECKS})`,
      `src/app/operations/[id]/alias/route.ts: its test file src/app/operations/[id]/alias/route.test.ts does not call expectUploadRules (${ROUTE_CHECKS})`,
    ]);
  });
});

describe("checkTestFiles: pages", () => {
  it("requires a test file", () => {
    expect(check({ "src/app/x/page.tsx": "" })).toEqual([
      `src/app/x/page.tsx: no test file - create src/app/x/page.test.tsx calling expectPageRequiresLogin or expectPublicPage (${PAGE_CHECKS})`,
    ]);
  });

  it("accepts a page that requires login or is declared public", () => {
    expect(
      check({
        "src/app/x/page.tsx": "",
        "src/app/x/page.test.ts": "expectPageRequiresLogin(Page, { actAs });",
        "src/app/page.tsx": "",
        "src/app/page.test.ts": "expectPublicPage(Page);",
      }),
    ).toEqual([]);
  });

  it("requires the login check or a public declaration elsewhere", () => {
    expect(
      check({
        "src/app/x/page.tsx": "",
        "src/app/x/page.test.tsx": "it('renders', () => {});",
      }),
    ).toEqual([
      `src/app/x/page.tsx: its test file src/app/x/page.test.tsx does not call expectPageRequiresLogin or expectPublicPage (${PAGE_CHECKS})`,
    ]);
  });

  it("requires the token check under device/ and view/", () => {
    expect(
      check({
        "src/app/view/[token]/page.tsx": "",
        "src/app/view/[token]/page.test.tsx":
          "expectPageRequiresLogin(Page, { actAs });",
      }),
    ).toEqual([
      `src/app/view/[token]/page.tsx: its test file src/app/view/[token]/page.test.tsx does not call expectPageRequiresToken (${PAGE_CHECKS})`,
    ]);
  });

  it("refuses a public declaration under admin/, device/ and view/", () => {
    expect(
      check({
        "src/app/admin/users/page.tsx": "",
        "src/app/admin/users/page.test.ts":
          "expectPageRequiresAdmin(Page, { actAs });\nexpectPublicPage(Page);",
        "src/app/device/[token]/page.tsx": "",
        "src/app/device/[token]/page.test.tsx":
          "expectPageRequiresToken(Page);\nexpectPublicPage(Page);",
      }),
    ).toEqual([
      `src/app/admin/users/page.tsx: its test file src/app/admin/users/page.test.ts declares the page public with expectPublicPage, but a page under src/app/admin/ cannot be public - remove that call (${PAGE_CHECKS})`,
      `src/app/device/[token]/page.tsx: its test file src/app/device/[token]/page.test.tsx declares the page public with expectPublicPage, but a page under src/app/device/ cannot be public - remove that call (${PAGE_CHECKS})`,
    ]);
  });

  it("requires the admin check under admin/", () => {
    expect(
      check({
        "src/app/admin/users/page.tsx": "",
        "src/app/admin/users/page.test.ts": "expectPublicPage(Page);",
      }),
    ).toEqual([
      `src/app/admin/users/page.tsx: its test file src/app/admin/users/page.test.ts does not call expectPageRequiresAdmin (${PAGE_CHECKS})`,
      `src/app/admin/users/page.tsx: its test file src/app/admin/users/page.test.ts declares the page public with expectPublicPage, but a page under src/app/admin/ cannot be public - remove that call (${PAGE_CHECKS})`,
    ]);
  });
});
