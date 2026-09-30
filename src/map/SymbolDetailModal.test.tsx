import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import type { ActionResult } from "@/app/action-result";
import { buttonColor } from "@/test/button-color";
import { clickModalOverlay } from "@/test/modal-overlay";
import { render, screen, waitFor, within } from "@/test/render";
import { SymbolDetailModal } from "./SymbolDetailModal";
import { aSymbol } from "./symbol.fixtures";

type Props = ComponentProps<typeof SymbolDetailModal>;

const token = "secret-token-123";
const rk1 = (deviceLinkToken: string | null = null) =>
  aSymbol({
    lat: 1,
    lng: 2,
    composition: {
      grundzeichen: "ortsfeste-stelle",
      organisation: "hilfsorganisation",
      text: "RK 1",
    },
    deviceLinkToken,
  });

async function openDetail(over: Partial<Props> = {}) {
  const props: Props = {
    symbol: rk1(token),
    onClose: vi.fn(),
    onUpdate: vi.fn(async () => ({})),
    onDelete: vi.fn(async () => ({})),
    onGenerateDeviceLink: vi.fn(async () => ({})),
    ...over,
  };
  // The workspace closes the dialog by clearing the symbol.
  const { rerender } = render(<SymbolDetailModal {...props} />);
  const rerenderWith = (next: Partial<Props>) =>
    rerender(<SymbolDetailModal {...props} {...next} />);
  vi.mocked(props.onClose).mockImplementation(() =>
    rerenderWith({ symbol: null }),
  );
  await screen.findByRole("dialog", { name: "Kartenzeichen" });
  return { props, rerenderWith };
}

const save = () => userEvent.click(screen.getByText("Speichern"));

const editLabel = async () => {
  const label = screen.getByLabelText("Bezeichnung");
  await userEvent.clear(label);
  await userEvent.type(label, "RK 9");
};

const detailDialog = () =>
  screen.queryByRole("dialog", { name: "Kartenzeichen" });

const hanging = () => new Promise<ActionResult>(() => {});

const cancelWays = [
  [
    "Abbrechen",
    (dialog: HTMLElement) =>
      userEvent.click(
        within(dialog).getByRole("button", { name: "Abbrechen" }),
      ),
  ],
  ["Escape", () => userEvent.keyboard("{Escape}")],
  ["a click beside the confirmation", () => clickModalOverlay()],
] as const;

describe("SymbolDetailModal", () => {
  it("saves an edit and closes", async () => {
    const { props } = await openDetail();
    expect(screen.getByLabelText("Bezeichnung")).toHaveValue("RK 1");
    await editLabel();
    await save();
    expect(props.onUpdate).toHaveBeenCalledWith(
      "s1",
      expect.objectContaining({
        grundzeichen: "ortsfeste-stelle",
        text: "RK 9",
      }),
    );
    await waitFor(() => expect(props.onClose).toHaveBeenCalled());
  });

  it("stays open and shows a returned {error}", async () => {
    const { props } = await openDetail({
      onUpdate: vi.fn(async () => ({
        error: "Ungültige Zeichen-Komposition.",
      })),
    });
    await save();
    expect(
      await screen.findByText("Ungültige Zeichen-Komposition."),
    ).toBeInTheDocument();
    expect(props.onClose).not.toHaveBeenCalled();
  });

  it("stays open and shows a fallback when saving throws", async () => {
    const { props } = await openDetail({
      onUpdate: vi.fn().mockRejectedValue(new Error("boom")),
    });
    await save();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Speichern fehlgeschlagen. Bitte erneut versuchen.",
    );
    expect(props.onClose).not.toHaveBeenCalled();
  });

  it("locks Löschen while saving", async () => {
    await openDetail({ onUpdate: hanging });
    await save();
    expect(
      screen.getByText("Löschen").closest("button") as HTMLElement,
    ).toHaveAttribute("data-loading");
  });

  it("closes on Escape", async () => {
    const { props } = await openDetail();
    await userEvent.keyboard("{Escape}");
    expect(props.onClose).toHaveBeenCalled();
    await waitFor(() => expect(detailDialog()).toBeNull());
  });

  it("generates a device link", async () => {
    const { props } = await openDetail({ symbol: rk1() });
    await userEvent.click(screen.getByText(/Gerätelink erzeugen/));
    expect(props.onGenerateDeviceLink).toHaveBeenCalledWith("s1");
  });

  describe("confirming", () => {
    const confirmations = [
      {
        name: "deleting",
        title: "Kartenzeichen löschen",
        ask: () => userEvent.click(screen.getByText("Löschen")),
        confirmLabel: "Endgültig löschen",
        action: "onDelete",
      },
      {
        name: "regenerating the device link",
        title: "Gerätelink neu generieren",
        ask: () =>
          userEvent.click(
            screen.getByRole("button", { name: "Gerätelink neu generieren" }),
          ),
        confirmLabel: "Neu generieren",
        action: "onGenerateDeviceLink",
      },
    ] as const;

    describe.each(confirmations)("when $name", (confirmation) => {
      const ask = async () => {
        await confirmation.ask();
        return screen.findByRole("dialog", { name: confirmation.title });
      };

      it.each(cancelWays)(
        "keeps the detail and its unsaved input after cancelling with %s",
        async (_, cancel) => {
          const action = vi.fn(async () => ({}));
          await openDetail({ [confirmation.action]: action });
          await editLabel();
          const dialog = await ask();

          await cancel(dialog);

          await waitFor(() =>
            expect(
              screen.queryByRole("dialog", { name: confirmation.title }),
            ).toBeNull(),
          );
          expect(action).not.toHaveBeenCalled();
          expect(detailDialog()).toBeInTheDocument();
          expect(screen.getByLabelText("Bezeichnung")).toHaveValue("RK 9");
        },
      );

      it("keeps both dialogs open on Escape or a click beside while running", async () => {
        const action = vi.fn(hanging);
        await openDetail({ [confirmation.action]: action });
        const dialog = await ask();

        await userEvent.click(
          within(dialog).getByRole("button", {
            name: confirmation.confirmLabel,
          }),
        );
        await userEvent.keyboard("{Escape}");
        await clickModalOverlay();

        expect(
          screen.getByRole("dialog", { name: confirmation.title }),
        ).toBeInTheDocument();
        expect(detailDialog()).toBeInTheDocument();
        expect(action).toHaveBeenCalledTimes(1);
      });
    });

    it("deletes the Kartenzeichen only once confirmed and closes both dialogs", async () => {
      const onDelete = vi.fn(async () => ({}));
      await openDetail({ onDelete });

      await userEvent.click(screen.getByText("Löschen"));
      const dialog = await screen.findByRole("dialog", {
        name: "Kartenzeichen löschen",
      });

      expect(onDelete).not.toHaveBeenCalled();
      expect(dialog).toHaveTextContent(
        "Das Kartenzeichen verschwindet von der Lagekarte, ein Gerätelink wird ungültig. Das lässt sich nicht rückgängig machen.",
      );
      const confirm = within(dialog).getByRole("button", {
        name: "Endgültig löschen",
      });
      expect(buttonColor(confirm)).toBe("red");

      await userEvent.click(confirm);

      expect(onDelete).toHaveBeenCalledWith("s1");
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    });

    it.each([
      [
        "a returned error",
        async () => ({ error: "Kartenzeichen gesperrt." }),
        "Kartenzeichen gesperrt.",
      ],
      [
        "a thrown failure",
        async (): Promise<ActionResult> => {
          throw new Error("offline");
        },
        "Das hat nicht geklappt. Bitte erneut versuchen.",
      ],
    ])(
      "shows %s in the open confirmation and keeps the Kartenzeichen",
      async (_, onDelete, message) => {
        const { props } = await openDetail({ onDelete });
        await userEvent.click(screen.getByText("Löschen"));
        const dialog = await screen.findByRole("dialog", {
          name: "Kartenzeichen löschen",
        });

        await userEvent.click(
          within(dialog).getByRole("button", { name: "Endgültig löschen" }),
        );

        expect(within(dialog).getByRole("alert")).toHaveTextContent(message);
        expect(detailDialog()).toBeInTheDocument();
        expect(props.onClose).not.toHaveBeenCalled();
        expect(
          within(dialog).getByRole("button", { name: "Endgültig löschen" }),
        ).toBeEnabled();
        expect(
          within(dialog).getByRole("button", { name: "Abbrechen" }),
        ).toBeEnabled();
      },
    );

    it("does not ask again for another Kartenzeichen after the asked one vanished", async () => {
      const { rerenderWith } = await openDetail();
      await userEvent.click(screen.getByText("Löschen"));
      await screen.findByRole("dialog", { name: "Kartenzeichen löschen" });

      rerenderWith({ symbol: null });
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
      rerenderWith({ symbol: { ...rk1(), id: "s2" } });

      await screen.findByRole("dialog", { name: "Kartenzeichen" });
      expect(
        screen.queryByRole("dialog", { name: "Kartenzeichen löschen" }),
      ).toBeNull();
    });

    it("keeps the detail open after regenerating and shows the new link", async () => {
      const { props, rerenderWith } = await openDetail();
      await userEvent.click(
        screen.getByRole("button", { name: "Gerätelink neu generieren" }),
      );
      const dialog = await screen.findByRole("dialog", {
        name: "Gerätelink neu generieren",
      });

      await userEvent.click(
        within(dialog).getByRole("button", { name: "Neu generieren" }),
      );

      expect(props.onGenerateDeviceLink).toHaveBeenCalledWith("s1");
      await waitFor(() =>
        expect(
          screen.queryByRole("dialog", { name: "Gerätelink neu generieren" }),
        ).toBeNull(),
      );
      expect(detailDialog()).toBeInTheDocument();

      rerenderWith({ symbol: rk1("fresh-token") });

      expect(screen.getByLabelText("Gerätelink")).toHaveValue(
        `${window.location.origin}/device/fresh-token`,
      );
    });
  });
});
