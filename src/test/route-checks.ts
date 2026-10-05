import { beforeEach, describe, expect, it } from "vitest";
import { generatedBody } from "./scripted-fetch";
import { streamedRequest } from "./upload-request";

/** A route handler module, imported whole: `import * as route from "./route"`. */
export type RouteModule = Record<string, unknown>;

const METHODS = [
  "GET",
  "HEAD",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "OPTIONS",
] as const;

type Method = (typeof METHODS)[number];

/**
 * Who sends the next request; the test file owns the mocked cookie state.
 * "an unknown session" sends a session cookie no session has.
 */
export type SendAs = (
  caller: "anonymous" | "an unknown session" | "user",
) => Promise<void>;

/** What a route answers: a redirect, or a status with an optional `{ error }`. */
export type RouteAnswer =
  | { redirectTo: string }
  | { status: number; error?: string };

/**
 * How a route refuses an anonymous caller: off to `/login`, or 401 where a
 * redirect would make `fetch` resend the body.
 */
export type LoginRefusal = { redirectTo: "/login" } | { status: 401 };

/** How to send a request to one method, and what it answers. */
export interface RouteCall {
  send: () => Promise<Response>;
  answer: RouteAnswer;
}

/**
 * Registers tests that `calls` names exactly the methods `route` exports, and
 * that each method, sent by an anonymous caller, gets its answer: a redirect
 * to `/login`, or 401 where a redirect would make `fetch` resend the body.
 */
export function expectRouteRequiresLogin(
  route: RouteModule,
  calls: Partial<Record<Method, RouteCall & { answer: LoginRefusal }>>,
  options: { sendAs: SendAs },
): void {
  describe("login required", () => {
    itNamesEveryMethod(route, calls);

    for (const [method, { send, answer }] of entries(calls)) {
      it(`refuses ${method} from an anonymous caller`, async () => {
        await options.sendAs("anonymous");
        expect(await answerOf(send)).toEqual(answer);
      });
    }
  });
}

/** How to send a request to one method with a given link token. */
export interface TokenCall {
  send: (token: string) => Promise<Response>;
}

/**
 * Registers tests that `calls` names exactly the methods `route` exports, and
 * that each method answers 403 to a token that is no link. The test file gives
 * the route a real database, so the route's own access lookup runs.
 */
export function expectRouteRequiresToken(
  route: RouteModule,
  calls: Partial<Record<Method, TokenCall>>,
): void {
  describe("valid token required", () => {
    itNamesEveryMethod(route, calls);

    for (const [method, { send }] of entries(calls)) {
      it(`refuses ${method} for a token that is no link`, async () => {
        expect(await answerOf(() => send("no-such-link"))).toEqual({
          status: 403,
        });
      });
    }
  });
}

/** A call with an object id that is not a UUID, and what is stored around it. */
export interface NonUuidCall extends RouteCall {
  stored: () => Promise<unknown>;
}

/**
 * Registers tests that `calls` names exactly the methods `route` exports, and
 * that each method, sent with an object id that is not a UUID, gets its
 * answer and changes nothing `stored` sees. The test file signs the caller in
 * or gives a valid token.
 */
export function expectNonUuidObjectIdRefused(
  route: RouteModule,
  calls: Partial<Record<Method, NonUuidCall>>,
): void {
  describe("object id that is not a UUID", () => {
    itNamesEveryMethod(route, calls);

    for (const [method, { send, answer, stored }] of entries(calls)) {
      it(`refuses it on ${method} and changes nothing`, async () => {
        const before = await stored();

        expect(await answerOf(send)).toEqual(answer);

        expect(await stored()).toEqual(before);
      });
    }
  });
}

/**
 * How to send a streamed request to one upload method, the message of its
 * size limit, and what is stored around it.
 */
export interface UploadCall {
  send: (request: Request) => Promise<Response>;
  tooLarge: string;
  stored: () => Promise<unknown>;
}

const MB = 1024 * 1024;
const CHUNK = 64 * 1024;

const FOREIGN_ORIGINS: [string, Record<string, string>][] = [
  ["another host", { origin: "https://evil.example", host: "einsatz.test" }],
  [
    "a sibling host behind the reverse proxy",
    {
      origin: "https://lager.drk.test",
      host: "app:3000",
      "x-forwarded-host": "einsatz.drk.test",
    },
  ],
  ["an opaque origin", { origin: "null", host: "einsatz.test" }],
  ["a malformed origin", { origin: "einsatz.test", host: "einsatz.test" }],
];

/**
 * Registers tests that `calls` names exactly the `POST` and `PUT` methods
 * `route` exports, and for each of them: 401 without a session and with an
 * unknown one, before reading a byte; 403 for a request from another site,
 * before reading a byte and storing anything; 413 for a body over the limit
 * without Content-Length, reading at most one chunk past 21 MB, cancelling
 * the rest and storing nothing.
 */
export function expectUploadRules(
  route: RouteModule,
  calls: Partial<Record<"POST" | "PUT", UploadCall>>,
  options: { sendAs: SendAs },
): void {
  const { sendAs } = options;

  describe("upload rules", () => {
    it("names every exported POST and PUT, and nothing else", () => {
      expect(Object.keys(calls).toSorted()).toEqual(
        exportedMethods(route).filter((m) => m === "POST" || m === "PUT"),
      );
    });

    for (const [method, { send, tooLarge, stored }] of entries(calls)) {
      describe(method, () => {
        it.each(["anonymous", "an unknown session"] as const)(
          "answers 401 to %s without reading the body",
          async (caller) => {
            await sendAs(caller);
            const body = generatedBody({ totalBytes: 5 * MB });

            const response = await send(streamedRequest(method, body.stream));

            expect(response.status).toBe(401);
            expect(body.pulled()).toBe(0);
          },
        );

        describe("signed in", () => {
          beforeEach(() => sendAs("user"));

          it.each(FOREIGN_ORIGINS)(
            "answers 403 for %s without reading the body or storing anything",
            async (_, headers) => {
              const before = await stored();
              const body = generatedBody({ totalBytes: 5 * MB });

              const response = await send(
                streamedRequest(method, body.stream, headers),
              );

              expect(response.status).toBe(403);
              expect(body.pulled()).toBe(0);
              expect(await stored()).toEqual(before);
            },
          );

          it("answers 413 over the limit, stops reading after 21 MB and stores nothing", async () => {
            const before = await stored();
            const body = generatedBody({
              totalBytes: 22 * MB,
              chunkBytes: CHUNK,
            });

            const response = await send(streamedRequest(method, body.stream));

            expect(response.status).toBe(413);
            expect(await response.json()).toEqual({ error: tooLarge });
            expect(body.pulled()).toBeGreaterThan(21 * MB);
            expect(body.pulled()).toBeLessThanOrEqual(21 * MB + CHUNK);
            expect(body.cancelled()).toBe(true);
            expect(await stored()).toEqual(before);
          });
        });
      });
    }
  });
}

function itNamesEveryMethod(route: RouteModule, calls: object): void {
  it("names every exported method, and nothing else", () => {
    expect(Object.keys(calls).toSorted()).toEqual(exportedMethods(route));
  });
}

function exportedMethods(route: RouteModule): string[] {
  return Object.keys(route)
    .filter((name) => (METHODS as readonly string[]).includes(name))
    .toSorted();
}

function entries<M extends Method, C>(calls: Partial<Record<M, C>>): [M, C][] {
  return Object.entries(calls) as [M, C][];
}

/**
 * Sends the request and says where it redirected to, or its status and
 * `{ error }`. The test file mocks `redirect` to throw `{ redirectTo }`; any
 * other error fails the test.
 */
async function answerOf(send: () => Promise<Response>): Promise<RouteAnswer> {
  let response: Response;
  try {
    response = await send();
  } catch (error) {
    const redirectTo = (error as { redirectTo?: unknown }).redirectTo;
    if (typeof redirectTo !== "string") throw error;
    return { redirectTo };
  }
  const json = await response.json().catch(() => undefined);
  return json?.error === undefined
    ? { status: response.status }
    : { status: response.status, error: json.error };
}
