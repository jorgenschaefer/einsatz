import { Popover } from "@mantine/core";
import { describe, expect, it } from "vitest";
import { act, render, screen } from "./render";

describe("render", () => {
  // jsdom misst alles mit 0×0; die hide-Middleware von floating-ui hält den
  // Anker darum für verdeckt und blendet das Dropdown aus, sobald die
  // Positionierung durch ist. Unter Last kam das vor findByRole an → Flake.
  it("keeps an open popover visible once floating-ui has positioned it", async () => {
    render(
      <Popover opened>
        <Popover.Target>
          <button type="button">Anker</button>
        </Popover.Target>
        <Popover.Dropdown>Inhalt</Popover.Dropdown>
      </Popover>,
    );
    await act(() => new Promise((resolve) => setTimeout(resolve, 50)));
    expect(screen.getByRole("dialog")).toHaveTextContent("Inhalt");
  });
});
