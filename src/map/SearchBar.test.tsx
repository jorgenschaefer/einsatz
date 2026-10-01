import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@/test/render";
import { SearchBar, type SearchBarProps } from "./SearchBar";

function setup(over: Partial<SearchBarProps> = {}) {
  const props: SearchBarProps = {
    query: "",
    onQueryChange: vi.fn(),
    objectResults: [],
    addressResults: [],
    attribution: "Adresssuche © OpenStreetMap",
    onChooseAddress: vi.fn(),
    onChooseObject: vi.fn(),
    ...over,
  };
  render(<SearchBar {...props} />);
  return props;
}

describe("SearchBar", () => {
  it("fills the width of its container", () => {
    setup();
    const root = screen
      .getByLabelText("Suche")
      .closest(".mantine-TextInput-root")?.parentElement;
    expect(root?.style.width).toBe("100%");
  });

  it("reports typed queries", async () => {
    const props = setup();
    fireEvent.change(screen.getByLabelText("Suche"), {
      target: { value: "DOM" },
    });
    expect(props.onQueryChange).toHaveBeenCalled();
  });

  it("shows no results panel while the query is empty", () => {
    setup({
      query: "",
      objectResults: [{ id: "s1", label: "RK 83/1", lat: 1, lng: 2 }],
    });
    expect(screen.queryByText("RK 83/1")).toBeNull();
  });

  it("chooses an object result", async () => {
    const props = setup({
      query: "rk",
      objectResults: [{ id: "s1", label: "RK 83/1", lat: 1, lng: 2 }],
    });
    await userEvent.click(screen.getByLabelText("Suche"));
    await userEvent.click(screen.getByRole("button", { name: /RK 83\/1/ }));
    expect(props.onChooseObject).toHaveBeenCalledWith({
      id: "s1",
      label: "RK 83/1",
      lat: 1,
      lng: 2,
    });
    expect(props.onChooseAddress).not.toHaveBeenCalled();
  });

  it("shows no clear button while the query is empty", () => {
    setup({ query: "" });
    expect(screen.queryByRole("button", { name: "Suche löschen" })).toBeNull();
  });

  it("clears the query via the clear button", async () => {
    const props = setup({ query: "dom" });
    await userEvent.click(
      screen.getByRole("button", { name: "Suche löschen" }),
    );
    expect(props.onQueryChange).toHaveBeenCalledWith("");
  });

  it("chooses an address result and shows the geocoder attribution", async () => {
    const props = setup({
      query: "hamburg",
      addressResults: [{ label: "Rathaus, Hamburg", lat: 53.55, lng: 9.99 }],
    });
    await userEvent.click(screen.getByLabelText("Suche"));
    expect(screen.getByText(/OpenStreetMap/)).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: /Rathaus, Hamburg/ }),
    );
    expect(props.onChooseAddress).toHaveBeenCalledWith({
      label: "Rathaus, Hamburg",
      lat: 53.55,
      lng: 9.99,
    });
    expect(props.onChooseObject).not.toHaveBeenCalled();
  });

  describe("result list", () => {
    const OBJECT = { id: "s1", label: "RK 83/1", lat: 1, lng: 2 };
    const ADDRESS = { label: "Rathaus, Hamburg", lat: 53.55, lng: 9.99 };

    /** Hält den Suchtext wie die Ansichten, mit einem Knopf außerhalb. */
    function StatefulSearchBar({ initial }: { initial: string }) {
      const [query, setQuery] = useState(initial);
      return (
        <>
          <SearchBar
            query={query}
            onQueryChange={setQuery}
            objectResults={[OBJECT]}
            addressResults={[ADDRESS]}
            attribution="Adresssuche © OpenStreetMap"
            onChooseAddress={() => {}}
            onChooseObject={() => {}}
          />
          <button type="button">Außerhalb</button>
        </>
      );
    }

    const field = () => screen.getByLabelText("Suche");
    const listShown = () => screen.queryByText("Adressen") !== null;

    async function renderOpenList() {
      render(<StatefulSearchBar initial="" />);
      await userEvent.type(field(), "rk");
      expect(listShown()).toBe(true);
    }

    it.each([
      ["an address", ADDRESS.label],
      ["an Einsatzobjekt", OBJECT.label],
    ])("closes after choosing %s and keeps the query", async (_, label) => {
      await renderOpenList();
      await userEvent.click(
        screen.getByRole("button", { name: new RegExp(label) }),
      );
      expect(listShown()).toBe(false);
      expect(field()).toHaveValue("rk");
    });

    it("reopens when the field is clicked after a choice", async () => {
      await renderOpenList();
      await userEvent.click(screen.getByRole("button", { name: /RK 83\/1/ }));
      await userEvent.click(field());
      expect(listShown()).toBe(true);
    });

    it("reopens when the field gets the focus by keyboard", async () => {
      await renderOpenList();
      await userEvent.click(screen.getByRole("button", { name: "Außerhalb" }));
      expect(listShown()).toBe(false);
      await userEvent.tab({ shift: true });
      await userEvent.tab({ shift: true });
      expect(field()).toHaveFocus();
      expect(listShown()).toBe(true);
    });

    it("reopens when the query changes", async () => {
      await renderOpenList();
      await userEvent.keyboard("{Escape}");
      await userEvent.type(field(), "x");
      expect(listShown()).toBe(true);
      expect(field()).toHaveValue("rkx");
    });

    it("closes on Escape and keeps the query", async () => {
      await renderOpenList();
      await userEvent.keyboard("{Escape}");
      expect(listShown()).toBe(false);
      expect(field()).toHaveValue("rk");
    });

    it("closes on Escape on a result and returns the focus to the field", async () => {
      await renderOpenList();
      screen.getByRole("button", { name: /RK 83\/1/ }).focus();
      await userEvent.keyboard("{Escape}");
      expect(listShown()).toBe(false);
      expect(field()).toHaveFocus();
      expect(field()).toHaveValue("rk");
    });

    it("closes when the focus is tabbed out of field and list", async () => {
      await renderOpenList();
      screen.getByRole("button", { name: ADDRESS.label }).focus();
      await userEvent.tab();
      expect(screen.getByRole("button", { name: "Außerhalb" })).toHaveFocus();
      expect(listShown()).toBe(false);
    });

    it("stays open while the focus is tabbed between field and results", async () => {
      await renderOpenList();
      await userEvent.tab();
      await userEvent.tab();
      expect(screen.getByRole("button", { name: /RK 83\/1/ })).toHaveFocus();
      expect(listShown()).toBe(true);
    });

    it("reopens when the still focused field is clicked after Escape", async () => {
      await renderOpenList();
      await userEvent.keyboard("{Escape}");
      expect(field()).toHaveFocus();
      await userEvent.click(field());
      expect(listShown()).toBe(true);
    });

    it("closes on a click outside and keeps the query", async () => {
      await renderOpenList();
      await userEvent.click(screen.getByRole("button", { name: "Außerhalb" }));
      expect(listShown()).toBe(false);
      expect(field()).toHaveValue("rk");
    });

    it("stays open on a click inside the list", async () => {
      await renderOpenList();
      await userEvent.click(screen.getByText("Adressen"));
      expect(listShown()).toBe(true);
    });

    it("stays closed when shown again with a kept query until the field is used", async () => {
      render(<StatefulSearchBar initial="rk" />);
      expect(listShown()).toBe(false);
      await userEvent.click(field());
      expect(listShown()).toBe(true);
    });

    it("does not open on focus while the query is empty", async () => {
      render(<StatefulSearchBar initial="" />);
      await userEvent.click(field());
      expect(listShown()).toBe(false);
      expect(screen.queryByText("Keine Treffer.")).toBeNull();
    });
  });
});
