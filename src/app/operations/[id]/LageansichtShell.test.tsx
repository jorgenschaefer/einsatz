import { describe, expect, it } from "vitest";
import { render, screen } from "@/test/render";
import { LageansichtShell } from "./LageansichtShell";

describe("LageansichtShell", () => {
  it("shows the operation name, a back link and the map content", () => {
    render(
      <LageansichtShell operationName="Hochwasser" status="active">
        <div>Karte</div>
      </LageansichtShell>,
    );
    expect(screen.getByText("Hochwasser")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Einsätze/ })).toHaveAttribute(
      "href",
      "/operations",
    );
    expect(screen.getByText("aktiv")).toBeInTheDocument();
    expect(screen.getByText("Karte")).toBeInTheDocument();
  });

  it("carries no Einsatz lifecycle actions in the header (they live in the overview)", () => {
    render(
      <LageansichtShell operationName="Hochwasser" status="active">
        <div>Karte</div>
      </LageansichtShell>,
    );
    expect(
      screen.queryByRole("button", { name: /Einsatz-Aktionen/ }),
    ).toBeNull();
    expect(screen.queryByRole("button", { name: /Abschließen/ })).toBeNull();
    expect(
      screen.queryByRole("button", { name: /Einsatz löschen/ }),
    ).toBeNull();
  });
});
