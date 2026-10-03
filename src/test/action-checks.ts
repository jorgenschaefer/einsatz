import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import * as adminUsersActions from "@/app/admin/users/actions";
import { deleteOperationAction } from "@/app/operations/lifecycle-actions";
import type { Role } from "@/server/auth/users";
import type { Db } from "@/server/db/db";
import type { BadCalls } from "./bad-calls/bad-call";
import { oneOfEach } from "./bad-calls/fixture";
import { snapshotDb } from "./db-snapshot";

/** A `"use server"` module, imported whole: `import * as actions from "./actions"`. */
export type ActionModule = Record<string, unknown>;

/** Who calls the next action; the test file owns the mocked cookie state. */
export type ActAs = (caller: "anonymous" | Role) => Promise<void>;

/**
 * Admin-only by AC-6, whatever a test file declares: every export of the user
 * administration, and deleting an Einsatz.
 */
const ADMIN_ONLY: ReadonlySet<unknown> = new Set([
  ...Object.values(adminUsersActions),
  deleteOperationAction,
]);

/**
 * Registers tests that every export of `module` sends an anonymous caller to
 * the login, except those declared `public`, and that every export declared
 * `adminOnly` also sends a signed-in non-admin to the overview. Each export is
 * called without arguments: every action checks the caller before its input.
 */
export function expectEveryActionRequiresLogin(
  module: ActionModule,
  options: { public?: string[]; adminOnly?: string[]; actAs: ActAs },
): void {
  const { public: open = [], adminOnly = [], actAs } = options;
  const actions = exportedActions(module);
  const names = actions.map(([name]) => name);

  describe("login required", () => {
    it("declares only exports of the module public or admin-only", () => {
      expect([...open, ...adminOnly].filter((n) => !names.includes(n))).toEqual(
        [],
      );
    });

    it("declares every admin-only export admin-only", () => {
      const undeclared = actions
        .filter(
          ([name, action]) =>
            ADMIN_ONLY.has(action) && !adminOnly.includes(name),
        )
        .map(([name]) => name);
      expect(undeclared).toEqual([]);
    });

    it("declares no export both public and admin-only", () => {
      expect(open.filter((name) => adminOnly.includes(name))).toEqual([]);
    });

    for (const [name, action] of actions) {
      if (open.includes(name)) continue;
      describe(name, () => {
        it("sends an anonymous caller to the login", async () => {
          await actAs("anonymous");
          await expect(action()).rejects.toMatchObject({
            redirectTo: "/login",
          });
        });

        if (!adminOnly.includes(name)) return;
        it("sends a signed-in non-admin to the overview", async () => {
          await actAs("user");
          await expect(action()).rejects.toMatchObject({
            redirectTo: "/operations",
          });
        });
      });
    }
  });
}

/**
 * Registers tests that `table` names exactly the exports of `module`, and that
 * each of its bad calls, made by an admin against {@link oneOfEach}, gets its
 * answer and changes no row and no uploaded file.
 */
export function expectBadCallsRejected(
  module: ActionModule,
  table: BadCalls,
  options: { db: () => Db; actAs: ActAs },
): void {
  const { db, actAs } = options;
  const actions = exportedActions(module);

  describe("the table of bad calls", () => {
    it("names every export of the module, and nothing else", () => {
      expect(Object.keys(table).toSorted()).toEqual(
        actions.map(([name]) => name).toSorted(),
      );
    });

    it("says an action takes no input only when it has no parameters", () => {
      const mislabelled = actions
        .filter(
          ([name, action]) =>
            action.length > 0 && table[name] === "takes no input",
        )
        .map(([name]) => name);
      expect(mislabelled).toEqual([]);
    });

    it("gives every action that takes input at least one bad call", () => {
      const withoutCalls = Object.entries(table)
        .filter(([, calls]) => calls.length === 0)
        .map(([name]) => name);
      expect(withoutCalls).toEqual([]);
    });
  });

  describe("bad calls", () => {
    let uploadsDir: string;
    let originalUploadsDir: string | undefined;

    beforeEach(async () => {
      uploadsDir = mkdtempSync(join(tmpdir(), "einsatz-bad-calls-"));
      originalUploadsDir = process.env.UPLOADS_DIR;
      process.env.UPLOADS_DIR = uploadsDir;
      await actAs("admin");
    });

    afterEach(() => {
      rmSync(uploadsDir, { recursive: true, force: true });
      if (originalUploadsDir === undefined) delete process.env.UPLOADS_DIR;
      else process.env.UPLOADS_DIR = originalUploadsDir;
    });

    for (const [name, calls] of Object.entries(table)) {
      if (calls === "takes no input") continue;
      for (const { what, answer, call } of calls) {
        it(`rejects ${name} with ${what} and stores nothing`, async () => {
          const fixture = await oneOfEach(db(), uploadsDir);
          const before = await everything(db(), uploadsDir);

          expect(await call(fixture)).toMatchObject(answer as object);

          expect(await everything(db(), uploadsDir)).toEqual(before);
        });
      }
    }
  });
}

type ServerAction = () => Promise<unknown>;

function exportedActions(module: ActionModule): [string, ServerAction][] {
  return Object.entries(module).filter(
    (entry): entry is [string, ServerAction] => typeof entry[1] === "function",
  );
}

/** Every row of every table and every file under `uploadsDir`. */
async function everything(db: Db, uploadsDir: string) {
  return {
    tables: await snapshotDb(db),
    uploads: readdirSync(uploadsDir, {
      recursive: true,
      encoding: "utf8",
    }).toSorted(),
  };
}
