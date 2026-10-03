import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { DeviceClosed } from "@/map/DeviceClosed";
import type { ActAs } from "./action-checks";

/** Who calls the page, and `props`: what Next.js would pass the page. */
type PageOptions<P> = { actAs: ActAs; props?: () => P };

/** Registers a test that an anonymous caller is sent to the login. */
export function expectPageRequiresLogin<P>(
  page: (props: P) => unknown,
  options: PageOptions<P>,
): void {
  describe("login required", () => {
    itSendsAnAnonymousCallerToTheLogin(page, options);
  });
}

/**
 * Registers tests that an anonymous caller is sent to the login and a
 * signed-in non-admin to the overview, as `requireAdmin` refuses them.
 */
export function expectPageRequiresAdmin<P>(
  page: (props: P) => unknown,
  options: PageOptions<P>,
): void {
  const { actAs, props } = options;
  describe("admin rights required", () => {
    itSendsAnAnonymousCallerToTheLogin(page, options);

    it("sends a signed-in non-admin to the overview", async () => {
      await actAs("user");
      expect(await visit(page, props)).toEqual({ redirectTo: "/operations" });
    });
  });
}

/**
 * Registers a test that a token which is no valid link gets the closure page,
 * and with it no Einsatz data.
 */
export function expectPageRequiresToken(
  page: (props: { params: Promise<{ token: string }> }) => unknown,
): void {
  describe("valid token required", () => {
    it("shows only the closure page for a token that is no link", async () => {
      const shown = await page({
        params: Promise.resolve({ token: "no-such-link" }),
      });
      expect(shown).toEqual(createElement(DeviceClosed));
    });
  });
}

/**
 * Declares the page public: registers a test that an anonymous caller is not
 * sent to the login. The page may render, or redirect elsewhere. `actAs` is
 * needed only by a page that looks at the session.
 */
export function expectPublicPage<P>(
  page: (props: P) => unknown,
  options: Partial<PageOptions<P>> = {},
): void {
  const { actAs, props } = options;
  describe("public", () => {
    it("does not send an anonymous caller to the login", async () => {
      await actAs?.("anonymous");
      expect(await visit(page, props)).not.toEqual({ redirectTo: "/login" });
    });
  });
}

function itSendsAnAnonymousCallerToTheLogin<P>(
  page: (props: P) => unknown,
  { actAs, props }: PageOptions<P>,
): void {
  it("sends an anonymous caller to the login", async () => {
    await actAs("anonymous");
    expect(await visit(page, props)).toEqual({ redirectTo: "/login" });
  });
}

/**
 * Calls the page and says where it redirected to, or that it rendered. The
 * test file mocks `redirect` to throw `{ redirectTo }`; any other error is
 * the page failing, and fails the test.
 */
async function visit<P>(
  page: (props: P) => unknown,
  props: (() => P) | undefined,
): Promise<{ redirectTo: string } | "rendered"> {
  try {
    await page(props?.() as P);
    return "rendered";
  } catch (error) {
    const redirectTo = (error as { redirectTo?: unknown }).redirectTo;
    if (typeof redirectTo !== "string") throw error;
    return { redirectTo };
  }
}
