import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ActionResult } from "@/app/action-result";
import { clickModalOverlay } from "@/test/modal-overlay";
import { render, screen, waitFor, within } from "@/test/render";
import { LageansichtShell } from "./LageansichtShell";

const CONNECTION_LOST_LABEL =
  "Verbindung getrennt – wird automatisch wiederhergestellt";

const HEADER_TEST_IDS = ["desktop-header", "mobile-header"] as const;

const shareProps = {
  viewLinks: [],
  onCreateViewLink: async (): Promise<ActionResult> => ({}),
  onDeleteViewLink: async (): Promise<ActionResult> => ({}),
};

describe("LageansichtShell", () => {
  it("shows the operation name, a back link and the map content", () => {
    render(
      <LageansichtShell
        operationName="Hochwasser"
        status="active"
        {...shareProps}
      >
        <div>Karte</div>
      </LageansichtShell>,
    );
    const desktopHeader = within(screen.getByTestId("desktop-header"));
    expect(
      desktopHeader.getByRole("heading", { name: "Hochwasser" }),
    ).toBeInTheDocument();
    expect(
      desktopHeader.getByRole("link", { name: /Einsätze/ }),
    ).toHaveAttribute("href", "/operations");
    expect(desktopHeader.getByText("aktiv")).toBeInTheDocument();
    expect(screen.getByText("Karte")).toBeInTheDocument();
  });

  it("shows the navigation only in the phone bar, not in a left bar", () => {
    render(
      <LageansichtShell
        operationName="Hochwasser"
        status="active"
        {...shareProps}
        navigation={<div>Leiste</div>}
      >
        <div>Karte</div>
      </LageansichtShell>,
    );
    expect(screen.queryByRole("navigation")).toBeNull();
    expect(
      within(screen.getByRole("contentinfo")).getByText("Leiste"),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Leiste")).toHaveLength(1);
  });

  it("carries no Einsatz lifecycle actions in the header (they live in the overview)", () => {
    render(
      <LageansichtShell
        operationName="Hochwasser"
        status="active"
        {...shareProps}
      >
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

  it("shows the status on both header sizes", () => {
    render(
      <LageansichtShell
        operationName="Hochwasser"
        status="active"
        {...shareProps}
      >
        <div>Karte</div>
      </LageansichtShell>,
    );
    for (const testId of HEADER_TEST_IDS) {
      expect(
        within(screen.getByTestId(testId)).getByText("aktiv"),
      ).toBeInTheDocument();
    }
  });

  it("offers a Teilen control that opens the given view links", async () => {
    render(
      <LageansichtShell
        operationName="Hochwasser"
        status="active"
        {...shareProps}
        viewLinks={[{ id: "1", label: "Leitstelle", token: "tok-a" }]}
      >
        <div>Karte</div>
      </LageansichtShell>,
    );
    expect(screen.queryByLabelText(/Bezeichnung/i)).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: /Teilen/i }));
    expect(await screen.findByText("Leitstelle")).toBeInTheDocument();
  });

  it("exposes the operation name as a heading on the phone header too", () => {
    render(
      <LageansichtShell
        operationName="Hochwasser"
        status="active"
        {...shareProps}
      >
        <div>Karte</div>
      </LageansichtShell>,
    );
    expect(
      within(screen.getByTestId("mobile-header")).getByRole("heading", {
        name: "Hochwasser",
      }),
    ).toBeInTheDocument();
  });

  it("shows the full operation name in a popover when the truncated name is tapped", async () => {
    const longName =
      "Cyclassics 2026 – Einsatzabschnitt 4 Nord an der langen Chaussee";
    render(
      <LageansichtShell
        operationName={longName}
        status="active"
        {...shareProps}
      >
        <div>Karte</div>
      </LageansichtShell>,
    );
    expect(screen.queryByRole("dialog")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: longName }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(longName)).toBeInTheDocument();
  });

  it("opens Teilen from the ⋮ menu, showing the given view links", async () => {
    render(
      <LageansichtShell
        operationName="Hochwasser"
        status="active"
        {...shareProps}
        viewLinks={[{ id: "1", label: "Leitstelle", token: "tok-a" }]}
      >
        <div>Karte</div>
      </LageansichtShell>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Menü" }));
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "Teilen" }),
    );
    expect(await screen.findByText("Leitstelle")).toBeInTheDocument();
  });

  describe("deleting a view link from Teilen", () => {
    async function askToDelete(
      onDeleteViewLink: (id: string) => Promise<ActionResult> = vi.fn(
        async () => ({}),
      ),
    ) {
      render(
        <LageansichtShell
          operationName="Hochwasser"
          status="active"
          {...shareProps}
          viewLinks={[{ id: "1", label: "Leitstelle", token: "tok-a" }]}
          onDeleteViewLink={onDeleteViewLink}
        >
          <div>Karte</div>
        </LageansichtShell>,
      );
      await userEvent.click(screen.getByRole("button", { name: "Teilen" }));
      await userEvent.click(
        await screen.findByRole("button", { name: "Leitstelle löschen" }),
      );
      return screen.findByRole("dialog", {
        name: "Ansichtslink „Leitstelle“ löschen",
      });
    }

    const shareDialog = () =>
      screen.getByRole("dialog", { name: "Ansichtslinks teilen" });

    it.each([
      ["on Escape", () => userEvent.keyboard("{Escape}")],
      ["on a click beside the confirmation", () => clickModalOverlay()],
    ])(
      "closes only the confirmation %s and returns to Teilen with the link",
      async (_, cancel) => {
        await askToDelete();

        await cancel();

        await waitFor(() =>
          expect(
            screen.queryByRole("dialog", {
              name: "Ansichtslink „Leitstelle“ löschen",
            }),
          ).toBeNull(),
        );
        expect(within(shareDialog()).getByText("Leitstelle")).toBeVisible();
      },
    );

    it.each([
      ["on Escape", () => userEvent.keyboard("{Escape}")],
      ["on a click beside the confirmation", () => clickModalOverlay()],
    ])("keeps both dialogs open %s while deleting", async (_, cancel) => {
      const onDeleteViewLink = vi.fn(() => new Promise<ActionResult>(() => {}));
      const confirmation = await askToDelete(onDeleteViewLink);

      await userEvent.click(
        within(confirmation).getByRole("button", {
          name: "Endgültig löschen",
        }),
      );
      await cancel();

      expect(onDeleteViewLink).toHaveBeenCalledWith("1");
      expect(confirmation).toBeInTheDocument();
      expect(shareDialog()).toBeInTheDocument();
    });
  });

  it("offers a Zurück zu Einsätze link in the ⋮ menu", async () => {
    render(
      <LageansichtShell
        operationName="Hochwasser"
        status="active"
        {...shareProps}
      >
        <div>Karte</div>
      </LageansichtShell>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Menü" }));
    expect(
      await screen.findByRole("menuitem", { name: "Zurück zu Einsätze" }),
    ).toHaveAttribute("href", "/operations");
  });

  it("shows no connection-lost symbol on either header size while connected", () => {
    render(
      <LageansichtShell
        operationName="Hochwasser"
        status="active"
        {...shareProps}
        connected
      >
        <div>Karte</div>
      </LageansichtShell>,
    );
    for (const testId of HEADER_TEST_IDS) {
      expect(
        within(screen.getByTestId(testId)).queryByRole("button", {
          name: CONNECTION_LOST_LABEL,
        }),
      ).toBeNull();
    }
  });

  it("shows an orange connection-lost symbol on both header sizes when disconnected, each with a popover explaining it", async () => {
    render(
      <LageansichtShell
        operationName="Hochwasser"
        status="active"
        {...shareProps}
        connected={false}
      >
        <div>Karte</div>
      </LageansichtShell>,
    );
    for (const testId of HEADER_TEST_IDS) {
      const button = within(screen.getByTestId(testId)).getByRole("button", {
        name: CONNECTION_LOST_LABEL,
      });
      await userEvent.click(button);
      const dialog = await screen.findByRole("dialog");
      expect(
        within(dialog).getByText(CONNECTION_LOST_LABEL),
      ).toBeInTheDocument();
      await userEvent.click(button);
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    }
  });
});
