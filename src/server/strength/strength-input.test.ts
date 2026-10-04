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

  it.each([
    [
      "all zeros",
      { leaders: 0, subLeaders: 0, crew: 0, additionalPersonnel: 0 },
    ],
    ["9999", { additionalPersonnel: 9999 }],
  ])("accepts %s", (_, over) => {
    expect(requireStrengthValues({ ...VALUES, ...over })).toEqual({
      ...VALUES,
      ...over,
    });
  });

  it.each([
    ["a negative number", { crew: -1 }],
    ["a fraction", { leaders: 1.5 }],
    ["not a number", { subLeaders: Number.NaN }],
    ["a count given as text", { crew: "9" }],
    ["additional personnel given as text", { additionalPersonnel: "3" }],
    ["more than 9999", { crew: 10000 }],
  ])("rejects %s", (_, over) => {
    expect(() => requireStrengthValues({ ...VALUES, ...over })).toThrow(
      INVALID_COUNTS,
    );
  });

  it("rejects a missing note rather than taking it as none", () => {
    const { note: _, ...withoutNote } = VALUES;

    expect(() => requireStrengthValues(withoutNote)).toThrow(
      new ValidationError("Die Notiz muss Text sein."),
    );
  });

  it("rejects a note that is not text", () => {
    expect(() => requireStrengthValues({ ...VALUES, note: 42 })).toThrow(
      new ValidationError("Die Notiz muss Text sein."),
    );
  });

  it("trims the note", () => {
    expect(
      requireStrengthValues({ ...VALUES, note: " Streife 2 " }),
    ).toMatchObject({ note: "Streife 2" });
  });

  it("stores a note of only blanks as none", () => {
    expect(requireStrengthValues({ ...VALUES, note: " \n" })).toMatchObject({
      note: null,
    });
  });
});
