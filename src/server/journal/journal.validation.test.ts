import { describe, expect, it } from "vitest";
import { ValidationError } from "@/server/validation";
import { requireEntryContent } from "./journal";

// Server Actions nehmen, was der Client schickt – die Typen hier lügen absichtlich.
// biome-ignore lint/suspicious/noExplicitAny: bewusst falsch getypte Eingaben
type Bad = any;

describe("requireEntryContent", () => {
  it("returns the content trimmed, a blank or missing Von, An and Weg as absent", () => {
    expect(
      requireEntryContent({ text: " Deich hält ", sender: " ", recipient: "" }),
    ).toEqual({
      text: "Deich hält",
      sender: null,
      recipient: null,
      channel: null,
    });
  });

  it("rejects a text that is blank once trimmed", () => {
    expect(() =>
      requireEntryContent({ text: " \n", sender: null } as Bad),
    ).toThrow(new ValidationError("Der Text darf nicht leer sein."));
  });

  it("rejects an array as content", () => {
    expect(() => requireEntryContent(["Deich hält"])).toThrow(
      new ValidationError("Ungültiger ETB-Eintrag."),
    );
  });

  it("counts the length of Von after trimming", () => {
    const value = "x".repeat(200);

    expect(
      requireEntryContent({ text: "Deich hält", sender: `  ${value}  ` }),
    ).toMatchObject({ sender: value });
  });
});
