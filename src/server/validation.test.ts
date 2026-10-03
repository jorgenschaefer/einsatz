import { describe, expect, it } from "vitest";
import {
  assertBoolean,
  assertHexColor,
  assertLatLng,
  assertObject,
  assertOpacity,
  assertRadius,
  assertScale,
  assertText,
  assertUuid,
  isValidLatLng,
  ValidationError,
} from "./validation";

describe("isValidLatLng", () => {
  it("accepts a coordinate within WGS84 bounds", () => {
    expect(isValidLatLng(53.55, 9.99)).toBe(true);
    expect(isValidLatLng(-90, -180)).toBe(true);
    expect(isValidLatLng(90, 180)).toBe(true);
  });

  it("rejects out-of-range latitude or longitude", () => {
    expect(isValidLatLng(90.1, 0)).toBe(false);
    expect(isValidLatLng(0, 180.1)).toBe(false);
    expect(isValidLatLng(-91, 0)).toBe(false);
  });

  it("rejects non-finite or non-number values", () => {
    expect(isValidLatLng(Number.NaN, 0)).toBe(false);
    expect(isValidLatLng(0, Number.POSITIVE_INFINITY)).toBe(false);
    expect(isValidLatLng("53", 9)).toBe(false);
    expect(isValidLatLng(null, undefined)).toBe(false);
  });
});

describe("assertLatLng", () => {
  it("passes for valid coordinates", () => {
    expect(() => assertLatLng(53.55, 9.99)).not.toThrow();
  });

  it("throws ValidationError for invalid coordinates", () => {
    expect(() => assertLatLng(200, 0)).toThrow(ValidationError);
    expect(() => assertLatLng(Number.NaN, 0)).toThrow(ValidationError);
  });
});

describe("assertOpacity", () => {
  it("accepts 0, 1 and values in between", () => {
    expect(() => assertOpacity(0)).not.toThrow();
    expect(() => assertOpacity(1)).not.toThrow();
    expect(() => assertOpacity(0.4)).not.toThrow();
  });

  it("rejects values outside 0–1 or non-finite", () => {
    expect(() => assertOpacity(-0.1)).toThrow(ValidationError);
    expect(() => assertOpacity(1.1)).toThrow(ValidationError);
    expect(() => assertOpacity(Number.NaN)).toThrow(ValidationError);
  });
});

describe("assertRadius", () => {
  it("accepts a positive radius", () => {
    expect(() => assertRadius(50)).not.toThrow();
  });

  it("rejects zero, negative or non-finite radius", () => {
    expect(() => assertRadius(0)).toThrow(ValidationError);
    expect(() => assertRadius(-5)).toThrow(ValidationError);
    expect(() => assertRadius(Number.POSITIVE_INFINITY)).toThrow(
      ValidationError,
    );
  });
});

describe("assertScale", () => {
  it("accepts a positive scale", () => {
    expect(() => assertScale(1000)).not.toThrow();
  });

  it("rejects zero, negative or non-finite scale", () => {
    expect(() => assertScale(0)).toThrow(ValidationError);
    expect(() => assertScale(-5)).toThrow(ValidationError);
    expect(() => assertScale(Number.NaN)).toThrow(ValidationError);
  });

  it("uses a scale-specific message, not the radius message", () => {
    let message = "";
    try {
      assertScale(0);
    } catch (err) {
      message = (err as ValidationError).message;
    }
    expect(message).not.toMatch(/Radius/);
    expect(message).toMatch(/Skalierung|Skala|Breite/);
  });
});

describe("assertUuid", () => {
  it("accepts a UUID in either case", () => {
    expect(() =>
      assertUuid("0f8fad5b-d9cb-469f-a165-70867728950e"),
    ).not.toThrow();
    expect(() =>
      assertUuid("0F8FAD5B-D9CB-469F-A165-70867728950E"),
    ).not.toThrow();
  });

  it.each([
    ["a placeholder", "op-1"],
    ["an empty string", ""],
    [
      "a UUID with a trailing character",
      "0f8fad5b-d9cb-469f-a165-70867728950ex",
    ],
    ["a number", 7],
    ["null", null],
    ["undefined", undefined],
    ["an object", { id: "0f8fad5b-d9cb-469f-a165-70867728950e" }],
  ])("rejects %s", (_, value) => {
    expect(() => assertUuid(value)).toThrow(
      new ValidationError("Ungültige ID."),
    );
  });
});

describe("assertText", () => {
  it.each([
    ["an empty string", ""],
    ["exactly the maximum", "x".repeat(200)],
    ["umlauts up to the maximum", "ä".repeat(200)],
  ])("accepts %s", (_, value) => {
    expect(() => assertText(value, "Die Beschriftung", 200)).not.toThrow();
  });

  it("rejects one character over the maximum, naming the field and the maximum", () => {
    expect(() => assertText("x".repeat(201), "Die Beschriftung", 200)).toThrow(
      new ValidationError(
        "Die Beschriftung darf höchstens 200 Zeichen lang sein.",
      ),
    );
  });

  it("writes the maximum with German digit grouping", () => {
    expect(() => assertText("x".repeat(10_001), "Der Text", 10_000)).toThrow(
      new ValidationError("Der Text darf höchstens 10.000 Zeichen lang sein."),
    );
  });

  it.each([
    ["a number", 7],
    ["null", null],
    ["undefined", undefined],
    ["an array", ["a"]],
  ])("rejects %s as no text", (_, value) => {
    expect(() => assertText(value, "Die Beschriftung", 200)).toThrow(
      new ValidationError("Die Beschriftung muss Text sein."),
    );
  });
});

describe("assertBoolean", () => {
  it.each([true, false])("accepts %s", (value) => {
    expect(() => assertBoolean(value, "Die Sichtbarkeit")).not.toThrow();
  });

  it.each([
    ['the text "yes"', "yes"],
    ['the text "false"', "false"],
    ["0", 0],
    ["null", null],
    ["undefined", undefined],
  ])("rejects %s", (_, value) => {
    expect(() => assertBoolean(value, "Die Sichtbarkeit")).toThrow(
      new ValidationError("Die Sichtbarkeit muss wahr oder falsch sein."),
    );
  });
});

describe("assertObject", () => {
  it.each([
    ["an empty object", {}],
    ["an object with fields", { lat: 1 }],
  ])("accepts %s", (_, value) => {
    expect(() => assertObject(value, "Ungültige Platzierung.")).not.toThrow();
  });

  it.each([
    ["null", null],
    ["undefined", undefined],
    ["an array", [1, 2]],
    ["text", "x"],
    ["a number", 7],
  ])("rejects %s with the given message", (_, value) => {
    expect(() => assertObject(value, "Ungültige Platzierung.")).toThrow(
      new ValidationError("Ungültige Platzierung."),
    );
  });
});

describe("assertHexColor", () => {
  it.each(["#e2001a", "#E2001A", "#000000"])("accepts %s", (value) => {
    expect(() => assertHexColor(value)).not.toThrow();
  });

  it.each([
    "red",
    "#e2001",
    "#e2001aa",
    "#gg001a",
    "e2001a",
    "#e2001a ",
    "",
    7,
    null,
  ])("rejects %s", (value) => {
    expect(() => assertHexColor(value)).toThrow(
      new ValidationError(
        "Die Farbe muss # und sechs Hex-Ziffern sein, etwa #e2001a.",
      ),
    );
  });
});
