import { describe, expect, it } from "vitest";
import { ValidationError } from "@/server/validation";
import { requireStationName, requireStrengthValues } from "./strength-input";

const VALUES = {
  leaders: 1,
  subLeaders: 2,
  crew: 9,
  additionalPersonnel: 0,
  note: null,
};
const INVALID_COUNTS = new ValidationError(
  "Die Stärke muss aus ganzen Zahlen von 0 bis 9999 bestehen.",
);

describe("requireStationName", () => {
  it("counts the length after trimming", () => {
    const name = "x".repeat(200);

    expect(requireStationName(`  ${name}  `)).toBe(name);
  });

  it("rejects null as no text", () => {
    expect(() => requireStationName(null)).toThrow(
      new ValidationError("Der Name der Stelle muss Text sein."),
    );
  });
});

describe("requireStrengthValues", () => {
  it("returns only the counts and the note", () => {
    expect(requireStrengthValues({ ...VALUES, stationId: "x" })).toEqual(
      VALUES,
    );
  });

  it("rejects an array as values", () => {
    expect(() => requireStrengthValues([1, 2, 9, 0])).toThrow(INVALID_COUNTS);
  });

  it("rejects a count given as text", () => {
    expect(() => requireStrengthValues({ ...VALUES, crew: "9" })).toThrow(
      INVALID_COUNTS,
    );
  });

  it("rejects a missing note rather than taking it as none", () => {
    const { note: _, ...withoutNote } = VALUES;

    expect(() => requireStrengthValues(withoutNote)).toThrow(
      new ValidationError("Die Notiz muss Text sein."),
    );
  });

  it("stores a note of only blanks as none", () => {
    expect(requireStrengthValues({ ...VALUES, note: " \n" })).toMatchObject({
      note: null,
    });
  });
});
