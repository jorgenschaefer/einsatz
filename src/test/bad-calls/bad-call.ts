import type { Fixture } from "./fixture";

// Server Actions nehmen, was der Client schickt – die Typen hier lügen absichtlich.
// biome-ignore lint/suspicious/noExplicitAny: bewusst falsch getypte Eingaben
export type Bad = any;

/** Ein Aufruf einer Server Action mit falscher Eingabe und die erwartete Antwort. */
export interface BadCall {
  what: string;
  answer: unknown;
  call: (f: Fixture) => Promise<unknown>;
}

/** Je Server Action ihre falschen Aufrufe. */
export type BadCalls = Record<string, BadCall[] | "takes no input">;

/** Die Antwort `{ error }` einer `ActionResult`- oder Formular-Action. */
export const rejects = (
  what: string,
  error: string,
  call: BadCall["call"],
): BadCall => ({ what, answer: { error }, call });

/** Die Antwort „keine Treffer“ der Kartensuche. */
export const noHits = (what: string, call: BadCall["call"]): BadCall => ({
  what,
  answer: [],
  call,
});

export const NOT_A_UUID = "op-1";
export const INVALID_ID = "Ungültige ID.";

export const tooLong = (field: string, max: string) =>
  `${field} darf höchstens ${max} Zeichen lang sein.`;

export const text = (length: number) => "x".repeat(length);

/** Je ein Aufruf mit einer Einsatz-ID und einer Objekt-ID, die keine UUID sind. */
export function idCalls(
  object: keyof Fixture,
  action: (operationId: string, id: string) => Promise<unknown>,
): BadCall[] {
  return [
    rejects("a non-UUID Einsatz-ID", INVALID_ID, (f) =>
      action(NOT_A_UUID, f[object]),
    ),
    rejects("a non-UUID object ID", INVALID_ID, (f) =>
      action(f.operationId, NOT_A_UUID),
    ),
  ];
}
