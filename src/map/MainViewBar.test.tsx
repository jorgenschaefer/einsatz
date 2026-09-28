import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@/test/render";
import { MainViewBar } from "./MainViewBar";

describe("MainViewBar", () => {
  it("marks the active view and reports a selection", async () => {
    const onSelect = vi.fn();
    render(
      <MainViewBar activeView="etb" onSelect={onSelect} newEtbEntries={0} />,
    );

    expect(screen.getByRole("button", { name: "ETB" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(
      screen.getByRole("button", { name: "Lagekarte" }),
    ).not.toHaveAttribute("aria-current");

    await userEvent.click(screen.getByRole("button", { name: "Lagekarte" }));
    expect(onSelect).toHaveBeenCalledWith("map");
  });

  it("offers „Stärke“ as the third view, after Lagekarte and ETB", async () => {
    const onSelect = vi.fn();
    render(
      <MainViewBar activeView="map" onSelect={onSelect} newEtbEntries={0} />,
    );

    expect(screen.getAllByRole("button").map((b) => b.textContent)).toEqual([
      "Lagekarte",
      "ETB",
      "Stärke",
    ]);

    await userEvent.click(screen.getByRole("button", { name: "Stärke" }));
    expect(onSelect).toHaveBeenCalledWith("strength");
  });

  it("marks neither item as current before the start view is known", () => {
    render(
      <MainViewBar activeView="default" onSelect={vi.fn()} newEtbEntries={0} />,
    );
    expect(screen.getByRole("button", { name: "ETB" })).not.toHaveAttribute(
      "aria-current",
    );
    expect(
      screen.getByRole("button", { name: "Lagekarte" }),
    ).not.toHaveAttribute("aria-current");
  });

  it("shows the number of new ETB entries on the ETB item", () => {
    render(
      <MainViewBar activeView="map" onSelect={vi.fn()} newEtbEntries={3} />,
    );
    expect(
      screen.getByRole("button", { name: "ETB 3 neue Einträge" }),
    ).toHaveTextContent(/^3ETB$/);
    expect(
      screen.getByRole("button", { name: "Lagekarte" }),
    ).toBeInTheDocument();
  });

  it("names a single new ETB entry in the singular", () => {
    render(
      <MainViewBar activeView="map" onSelect={vi.fn()} newEtbEntries={1} />,
    );
    expect(
      screen.getByRole("button", { name: "ETB 1 neuer Eintrag" }),
    ).toBeInTheDocument();
  });

  it("shows no count without new ETB entries", () => {
    render(
      <MainViewBar activeView="map" onSelect={vi.fn()} newEtbEntries={0} />,
    );
    expect(screen.getByRole("button", { name: "ETB" })).not.toHaveTextContent(
      "0",
    );
  });
});
