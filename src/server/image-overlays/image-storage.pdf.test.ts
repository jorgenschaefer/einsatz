import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { ValidationError } from "@/server/validation";
import { minimalPdf } from "@/test/minimal-pdf";
import { renderPdfFirstPageToPng } from "./image-storage";

// Ohne Mock: der echte PDF→PNG-Renderer, damit die Kantenlänge real ist.
describe("renderPdfFirstPageToPng", () => {
  it.each([
    ["A4", 595.28, 841.89],
    ["a non-round page", 2000.9, 1000.3],
    ["a huge non-round page", 200_000.7, 100_000.3],
    ["an elongated page", 400_000, 300],
    ["a page of exactly 4000:1", 4000, 1],
    ["a larger page of exactly 4000:1", 8000, 2],
  ])(
    "renders %s with its longer edge at 4000 px or less",
    async (_, widthPt, heightPt) => {
      const png = await renderPdfFirstPageToPng(minimalPdf(widthPt, heightPt));

      const { width = 0, height = 0 } = await sharp(png).metadata();
      expect(Math.max(width, height)).toBeLessThanOrEqual(4000);
      expect(Math.min(width, height)).toBeGreaterThanOrEqual(1);
    },
  );
});

describe("renderPdfFirstPageToPng, refusing", () => {
  it.each([
    ["a page under 1 pt", 0.5, 0.5],
    ["a page just over 4000:1", 4001, 1],
    ["a page far over 4000:1", 40_000_000, 1],
  ])("refuses %s as not convertible", async (_, widthPt, heightPt) => {
    await expect(
      renderPdfFirstPageToPng(minimalPdf(widthPt, heightPt)),
    ).rejects.toThrow(
      new ValidationError("Die PDF-Datei konnte nicht umgewandelt werden."),
    );
  });
});

describe("renderPdfFirstPageToPng, small pages", () => {
  it("renders at no more than scale 3, even just below 4000/3 pt", async () => {
    const png = await renderPdfFirstPageToPng(minimalPdf(1333, 500));

    expect(await sharp(png).metadata()).toMatchObject({
      width: 3999,
      height: 1500,
    });
  });
});
