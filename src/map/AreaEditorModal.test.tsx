import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import type { ActionResult } from "@/app/action-result";
import { buttonColor } from "@/test/button-color";
import { clickModalOverlay } from "@/test/modal-overlay";
import { render, screen, waitFor, within } from "@/test/render";
import { AreaEditorModal } from "./AreaEditorModal";
import type { RenderedArea } from "./SituationMap";

type Props = ComponentProps<typeof AreaEditorModal>;

const AREA: RenderedArea = {
  id: "a1",
  geometry: { shape: "circle", center: { lat: 53.5, lng: 9.9 }, radius: 100 },
  color: "#e2001a",
  opacity: 0.4,
  label: "Deich",
};

const LEGACY_CIRCLE: RenderedArea = {
  ...AREA,
  geometry: {
    shape: "circle",
    center: { lat: 53.5, lng: 9.9 },
    radius: 463.27,
  },
};

async function openEditor(over: Partial<Props> = {}) {
  const props: Props = {
    area: AREA,
    onClose: vi.fn(),
    onUpdateAreaStyle: vi.fn(async () => ({})),
    onUpdateAreaGeometry: vi.fn(async () => ({})),
    onDeleteArea: vi.fn(async () => ({})),
    onRedraw: vi.fn(),
    onMoveCircle: vi.fn(),
    ...over,
  };
  // The workspace closes the dialog by clearing the area.
  const { rerender } = render(<AreaEditorModal {...props} />);
  const rerenderWith = (next: Partial<Props>) =>
    rerender(<AreaEditorModal {...props} {...next} />);
  vi.mocked(props.onClose).mockImplementation(() =>
    rerenderWith({ area: null }),
  );
  const editor = await screen.findByRole("dialog", { name: "Bereich" });
  return { props, rerenderWith, editor };
}

const save = () => userEvent.click(screen.getByText("Speichern"));

const editorDialog = () => screen.queryByRole("dialog", { name: "Bereich" });

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

describe("AreaEditorModal", () => {
  it("saves the style and closes", async () => {
    const { props } = await openEditor();
    await save();
    expect(props.onUpdateAreaStyle).toHaveBeenCalledWith("a1", {
      color: "#e2001a",
      opacity: 0.4,
      label: "Deich",
    });
    await waitFor(() => expect(editorDialog()).toBeNull());
  });

  it.each([
    [
      "a returned {error}",
      async () => ({ error: "Die Deckkraft muss zwischen 0 und 1 liegen." }),
      "Die Deckkraft muss zwischen 0 und 1 liegen.",
    ],
    [
      "a fallback when saving throws",
      async (): Promise<ActionResult> => {
        throw new Error("boom");
      },
      "Speichern fehlgeschlagen. Bitte erneut versuchen.",
    ],
  ])("stays open and shows %s", async (_, onUpdateAreaStyle, message) => {
    const { props } = await openEditor({ onUpdateAreaStyle });
    await save();
    expect(await screen.findByRole("alert")).toHaveTextContent(message);
    expect(props.onClose).not.toHaveBeenCalled();
  });

  it("locks Speichern while saving", async () => {
    await openEditor({ onUpdateAreaStyle: hanging });
    const button = screen.getByRole("button", { name: "Speichern" });
    await userEvent.click(button);
    expect(button).toBeDisabled();
  });

  it("shows another Bereich without the previous one's input or error", async () => {
    const { rerenderWith } = await openEditor({
      onUpdateAreaStyle: vi.fn(async () => ({ error: "Stil ungültig." })),
    });
    const label = screen.getByLabelText("Beschriftung");
    await userEvent.clear(label);
    await userEvent.type(label, "Zone Süd");
    await save();
    expect(await screen.findByText("Stil ungültig.")).toBeInTheDocument();

    rerenderWith({ area: { ...AREA, id: "a9", label: "Neu" } });

    expect(screen.getByLabelText("Beschriftung")).toHaveValue("Neu");
    expect(screen.queryByText("Stil ungültig.")).not.toBeInTheDocument();
  });

  it("closes on Escape", async () => {
    const { props } = await openEditor();
    await userEvent.keyboard("{Escape}");
    expect(props.onClose).toHaveBeenCalled();
  });

  it("hands the Bereich over for Neu zeichnen and Verschieben", async () => {
    const { props } = await openEditor();
    await userEvent.click(screen.getByText(/Form neu zeichnen/));
    expect(props.onRedraw).toHaveBeenCalledWith(AREA);
    await userEvent.click(screen.getByText(/Verschieben/));
    expect(props.onMoveCircle).toHaveBeenCalledWith(AREA);
  });

  describe("changing a circle's radius", () => {
    const typeRadius = async (value: string) => {
      const radius = screen.getByLabelText(/Radius/);
      await userEvent.clear(radius);
      await userEvent.type(radius, value);
    };

    it("shows no radius field for a polygon", async () => {
      await openEditor({
        area: {
          ...AREA,
          geometry: {
            shape: "polygon",
            points: [
              { lat: 1, lng: 1 },
              { lat: 1, lng: 2 },
              { lat: 2, lng: 2 },
            ],
          },
        },
      });
      expect(screen.getByLabelText(/Beschriftung/)).toBeInTheDocument();
      expect(screen.queryByLabelText(/Radius/)).not.toBeInTheDocument();
      expect(screen.queryByText(/Verschieben/)).not.toBeInTheDocument();
    });

    it("saves a changed radius around the centre the client currently knows", async () => {
      const { props, rerenderWith } = await openEditor({ area: LEGACY_CIRCLE });
      await typeRadius("250");

      const moved = { lat: 54, lng: 10 };
      rerenderWith({
        area: {
          ...LEGACY_CIRCLE,
          geometry: { ...LEGACY_CIRCLE.geometry, center: moved },
        } as RenderedArea,
      });
      await save();

      expect(props.onUpdateAreaGeometry).toHaveBeenCalledWith("a1", {
        shape: "circle",
        center: moved,
        radius: 250,
      });
      expect(props.onUpdateAreaStyle).toHaveBeenCalledWith("a1", {
        color: "#e2001a",
        opacity: 0.4,
        label: "Deich",
      });
      await waitFor(() =>
        expect(screen.queryByLabelText(/Radius/)).not.toBeInTheDocument(),
      );
    });

    it("saves only the style when the radius is unchanged", async () => {
      const { props } = await openEditor({ area: LEGACY_CIRCLE });
      expect(screen.getByLabelText(/Radius/)).toHaveValue("463,27 m");
      await save();

      expect(props.onUpdateAreaStyle).toHaveBeenCalled();
      expect(props.onUpdateAreaGeometry).not.toHaveBeenCalled();
    });

    it("does not overwrite a radius changed elsewhere while the editor was open", async () => {
      const { props, rerenderWith } = await openEditor({ area: LEGACY_CIRCLE });

      rerenderWith({
        area: {
          ...LEGACY_CIRCLE,
          geometry: { ...LEGACY_CIRCLE.geometry, radius: 300 },
        } as RenderedArea,
      });
      await save();

      expect(props.onUpdateAreaStyle).toHaveBeenCalled();
      expect(props.onUpdateAreaGeometry).not.toHaveBeenCalled();
    });

    it("does not write the style when the radius save fails", async () => {
      const { props } = await openEditor({
        area: LEGACY_CIRCLE,
        onUpdateAreaGeometry: vi.fn(async () => ({
          error: "Bereich nicht gefunden.",
        })),
      });
      await typeRadius("250");
      await save();

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Bereich nicht gefunden.",
      );
      expect(props.onUpdateAreaGeometry).toHaveBeenCalled();
      expect(props.onUpdateAreaStyle).not.toHaveBeenCalled();
    });

    it("does not write the style when the radius save throws", async () => {
      const { props } = await openEditor({
        area: LEGACY_CIRCLE,
        onUpdateAreaGeometry: vi.fn(async () => {
          throw new Error("boom");
        }),
      });
      await typeRadius("250");
      await save();

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Speichern fehlgeschlagen.",
      );
      expect(props.onUpdateAreaStyle).not.toHaveBeenCalled();
    });

    it("shows the error when the style fails after the radius was saved", async () => {
      const { props } = await openEditor({
        area: LEGACY_CIRCLE,
        onUpdateAreaStyle: vi.fn(async () => ({
          error: "Die Deckkraft muss zwischen 0 und 1 liegen.",
        })),
      });
      await typeRadius("250");
      await save();

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Die Deckkraft muss zwischen 0 und 1 liegen.",
      );
      expect(props.onUpdateAreaGeometry).toHaveBeenCalledWith(
        "a1",
        expect.objectContaining({ radius: 250 }),
      );
    });
  });

  describe("confirming the deletion", () => {
    const editLabel = async () => {
      const label = screen.getByLabelText("Beschriftung");
      await userEvent.clear(label);
      await userEvent.type(label, "Zone Süd");
    };

    const ask = async (editor: HTMLElement) => {
      await userEvent.click(
        within(editor).getByRole("button", { name: "Löschen" }),
      );
      return screen.findByRole("dialog", { name: "Bereich löschen" });
    };

    it.each(cancelWays)(
      "keeps the editor and its unsaved input after cancelling with %s",
      async (_, cancel) => {
        const { props, editor } = await openEditor();
        await editLabel();
        const dialog = await ask(editor);

        await cancel(dialog);

        await waitFor(() =>
          expect(
            screen.queryByRole("dialog", { name: "Bereich löschen" }),
          ).toBeNull(),
        );
        expect(props.onDeleteArea).not.toHaveBeenCalled();
        expect(editorDialog()).toBeInTheDocument();
        expect(screen.getByLabelText("Beschriftung")).toHaveValue("Zone Süd");
      },
    );

    it("deletes the Bereich only once confirmed and closes both dialogs", async () => {
      const { props, editor } = await openEditor();
      const dialog = await ask(editor);

      expect(props.onDeleteArea).not.toHaveBeenCalled();
      expect(dialog).toHaveTextContent(
        "Der Bereich verschwindet von der Lagekarte. Das lässt sich nicht rückgängig machen.",
      );
      const confirm = within(dialog).getByRole("button", {
        name: "Endgültig löschen",
      });
      expect(buttonColor(confirm)).toBe("red");

      await userEvent.click(confirm);

      expect(props.onDeleteArea).toHaveBeenCalledWith("a1");
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    });

    it.each([
      [
        "a returned error",
        async () => ({ error: "Bereich gesperrt." }),
        "Bereich gesperrt.",
      ],
      [
        "a thrown failure",
        async (): Promise<ActionResult> => {
          throw new Error("offline");
        },
        "Das hat nicht geklappt. Bitte erneut versuchen.",
      ],
    ])(
      "shows %s in the open confirmation, not in the editor",
      async (_, onDeleteArea, message) => {
        const { props, editor } = await openEditor({ onDeleteArea });
        const dialog = await ask(editor);

        await userEvent.click(
          within(dialog).getByRole("button", { name: "Endgültig löschen" }),
        );

        expect(screen.getAllByRole("alert")).toEqual([
          within(dialog).getByRole("alert"),
        ]);
        expect(within(dialog).getByRole("alert")).toHaveTextContent(message);
        expect(editorDialog()).toBeInTheDocument();
        expect(props.onClose).not.toHaveBeenCalled();
        expect(
          within(dialog).getByRole("button", { name: "Endgültig löschen" }),
        ).toBeEnabled();
        expect(
          within(dialog).getByRole("button", { name: "Abbrechen" }),
        ).toBeEnabled();
      },
    );

    it("keeps both dialogs open on Escape or a click beside while deleting", async () => {
      const onDeleteArea = vi.fn(hanging);
      const { editor } = await openEditor({ onDeleteArea });
      const dialog = await ask(editor);

      await userEvent.click(
        within(dialog).getByRole("button", { name: "Endgültig löschen" }),
      );
      await userEvent.keyboard("{Escape}");
      await clickModalOverlay();

      expect(
        screen.getByRole("dialog", { name: "Bereich löschen" }),
      ).toBeInTheDocument();
      expect(editorDialog()).toBeInTheDocument();
      expect(onDeleteArea).toHaveBeenCalledTimes(1);
    });
  });
});
