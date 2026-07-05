import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@/test/render";
import { SearchBar, type SearchBarProps } from "./SearchBar";

function setup(over: Partial<SearchBarProps> = {}) {
  const props: SearchBarProps = {
    query: "",
    onQueryChange: vi.fn(),
    objectResults: [],
    addressResults: [],
    attribution: "Adresssuche © OpenStreetMap",
    onJump: vi.fn(),
    ...over,
  };
  render(<SearchBar {...props} />);
  return props;
}

describe("SearchBar", () => {
  it("reports typed queries", async () => {
    const props = setup();
    await userEvent.type(screen.getByLabelText("Suche"), "DOM");
    expect(props.onQueryChange).toHaveBeenCalled();
  });

  it("shows no results panel while the query is empty", () => {
    setup({
      query: "",
      objectResults: [{ id: "s1", label: "RK 83/1", lat: 1, lng: 2 }],
    });
    expect(screen.queryByText("RK 83/1")).toBeNull();
  });

  it("jumps to a located object result", async () => {
    const props = setup({
      query: "rk",
      objectResults: [{ id: "s1", label: "RK 83/1", lat: 1, lng: 2 }],
    });
    await userEvent.click(screen.getByRole("button", { name: /RK 83\/1/ }));
    expect(props.onJump).toHaveBeenCalledWith(1, 2);
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

  it("jumps to an address result and shows the geocoder attribution", async () => {
    const props = setup({
      query: "hamburg",
      addressResults: [{ label: "Rathaus, Hamburg", lat: 53.55, lng: 9.99 }],
    });
    expect(screen.getByText(/OpenStreetMap/)).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: /Rathaus, Hamburg/ }),
    );
    expect(props.onJump).toHaveBeenCalledWith(53.55, 9.99);
  });
});
