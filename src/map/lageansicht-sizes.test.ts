import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { SIDEBAR_WIDTH } from "./lageansicht-sizes";

describe("SIDEBAR_WIDTH", () => {
  it("is the width of the sidebar column in the Lageansicht's grid", () => {
    const css = readFileSync("src/map/situation-workspace.css", "utf8");
    expect(css).toContain(
      `grid-template-columns: minmax(0, 1fr) ${SIDEBAR_WIDTH}px;`,
    );
  });
});
