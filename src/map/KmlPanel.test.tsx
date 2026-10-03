import userEvent from "@testing-library/user-event";
import { strToU8, zipSync } from "fflate";
import { describe, expect, it, vi } from "vitest";
import type { ActionResult } from "@/app/action-result";
import { buttonColor } from "@/test/button-color";
import { clickModalOverlay } from "@/test/modal-overlay";
import {
  act,
  fireEvent,
  notificationArea,
  render,
  screen,
  waitFor,
  within,
} from "@/test/render";
import { type KmlOverlayView, KmlPanel, type KmlPanelProps } from "./KmlPanel";

const NOT_FOUND = "KML konnte nicht geladen werden (404).";

function renderPanel(over: Partial<KmlPanelProps> = {}) {
  const props: KmlPanelProps = {
    overlays: [],
    onAddFile: vi.fn(async () => ({})),
    onAddUrl: vi.fn(async () => ({})),
    onToggleVisibility: vi.fn(async () => ({})),
    onReload: vi.fn(async () => ({})),
    onRemove: vi.fn(async () => ({})),
    ...over,
  };
  render(<KmlPanel {...props} />);
  return props;
}

const urlOverlay: KmlOverlayView = {
  id: "k1",
  name: "Laufstrecke",
  sourceType: "url",
  visible: true,
};
const fileOverlay: KmlOverlayView = {
  id: "k2",
  name: "Zonen",
  sourceType: "file",
  visible: false,
};

const pending = () => vi.fn(() => new Promise<ActionResult>(() => {}));
const fileInput = () => screen.getByLabelText("KML-/KMZ-Datei einbinden");
const reloadButton = () => screen.getByRole("button", { name: "Neu laden" });
const reload = () => userEvent.click(reloadButton());
const addFile = (file = new File(["<kml/>"], "zonen.kml")) =>
  userEvent.upload(fileInput(), file);
const visibilitySwitch = (name: RegExp) => screen.getByRole("switch", { name });

function fileStillBeingRead() {
  const file = new File(["<kml/>"], "gross.kmz");
  file.arrayBuffer = () => new Promise<ArrayBuffer>(() => {});
  return file;
}

async function addUrl(name = "Strecke", url = "https://maps.example/x.kml") {
  fireEvent.change(screen.getByLabelText("Name"), { target: { value: name } });
  fireEvent.change(screen.getByLabelText("KML-/KMZ-URL"), {
    target: { value: url },
  });
  await userEvent.click(
    screen.getByRole("button", { name: "Per URL einbinden" }),
  );
}

async function askToRemove() {
  await userEvent.click(
    within(screen.getByTestId("kml-k2")).getByRole("button", {
      name: "Entfernen",
    }),
  );
  return screen.findByRole("dialog", {
    name: "KML-Overlay „Zonen“ entfernen",
  });
}

const confirmButton = (dialog: HTMLElement) =>
  within(dialog).getByRole("button", { name: "Entfernen" });

describe("KmlPanel", () => {
  it("lets a long name without spaces wrap in a row that wraps, aligned at the top with the buttons right-aligned", () => {
    const longName = `${"Einsatzabschnitt".repeat(5)}.kml`;
    renderPanel({
      overlays: [
        { ...urlOverlay, name: longName },
        { ...fileOverlay, name: longName },
      ],
    });

    for (const id of ["k1", "k2"]) {
      const row = screen.getByTestId(`kml-${id}`);
      expect(within(row).getByText(longName)).toHaveStyle({
        overflowWrap: "anywhere",
      });
      expect(row.firstElementChild).toHaveStyle({
        "--group-align": "flex-start",
        "--group-wrap": "wrap",
      });
      expect(row.querySelector(".mantine-Switch-root")).toHaveStyle({
        flex: "1 1 auto",
        maxWidth: "100%",
      });
      expect(
        within(row).getByRole("button", { name: "Entfernen" }).parentElement,
      ).toHaveStyle({ marginLeft: "auto" });
    }
  });

  it("shows a per-section empty hint when a section has no overlays", () => {
    renderPanel();
    expect(screen.getByText(/Noch keine KML-Datei/)).toBeInTheDocument();
    expect(screen.getByText(/Noch keine KML-URL/)).toBeInTheDocument();
  });

  it("lists each overlay under the section matching its source", () => {
    renderPanel({ overlays: [urlOverlay, fileOverlay] });
    const fileSection = within(
      screen.getByRole("region", { name: "KML-Datei" }),
    );
    expect(fileSection.getByTestId("kml-k2")).toBeInTheDocument();
    expect(fileSection.queryByTestId("kml-k1")).toBeNull();
    const urlSection = within(screen.getByRole("region", { name: "KML-URL" }));
    expect(urlSection.getByTestId("kml-k1")).toBeInTheDocument();
    expect(urlSection.queryByTestId("kml-k2")).toBeNull();
  });

  it("adds a KML by URL and empties the fields", async () => {
    const onAddUrl = vi.fn(async () => ({}));
    renderPanel({ onAddUrl });

    await addUrl(" Laufstrecke ", " https://maps.example/x.kml ");

    expect(onAddUrl).toHaveBeenCalledWith(
      "Laufstrecke",
      "https://maps.example/x.kml",
    );
    expect(screen.getByLabelText("Name")).toHaveValue("");
    expect(screen.getByLabelText("KML-/KMZ-URL")).toHaveValue("");
  });

  const kml = "<kml><name>Strecken</name></kml>";
  it.each([
    ["a KML file, reading it", new File([kml], "zonen.kml")],
    [
      "a KMZ file, unpacking it",
      new File([zipSync({ "doc.kml": strToU8(kml) })], "WTH26 all courses.kmz"),
    ],
  ])("adds %s client-side", async (_, file) => {
    const onAddFile = vi.fn(async () => ({}));
    renderPanel({ onAddFile });

    await addFile(file);

    await waitFor(() => expect(onAddFile).toHaveBeenCalledWith(file.name, kml));
  });

  it("toggles visibility of an overlay", async () => {
    const onToggleVisibility = vi.fn(async () => ({}));
    renderPanel({ overlays: [urlOverlay], onToggleVisibility });
    await userEvent.click(visibilitySwitch(/Laufstrecke/));
    expect(onToggleVisibility).toHaveBeenCalledWith("k1", false);
  });

  it("offers reload only for URL sources", async () => {
    const onReload = vi.fn(async () => ({}));
    renderPanel({ overlays: [urlOverlay, fileOverlay], onReload });
    const urlRow = within(screen.getByTestId("kml-k1"));
    await userEvent.click(urlRow.getByRole("button", { name: "Neu laden" }));
    expect(onReload).toHaveBeenCalledWith("k1");
    expect(
      within(screen.getByTestId("kml-k2")).queryByRole("button", {
        name: "Neu laden",
      }),
    ).toBeNull();
  });

  describe("removing an overlay", () => {
    it("asks for confirmation first and removes only once confirmed", async () => {
      const onRemove = vi.fn(async () => ({}));
      renderPanel({ overlays: [urlOverlay, fileOverlay], onRemove });

      const dialog = await askToRemove();

      expect(onRemove).not.toHaveBeenCalled();
      expect(dialog).toHaveTextContent(
        "Um es wieder anzuzeigen, muss die Datei oder URL neu eingebunden werden.",
      );
      expect(buttonColor(confirmButton(dialog))).toBe("red");

      await userEvent.click(confirmButton(dialog));

      expect(onRemove).toHaveBeenCalledWith("k2");
      expect(onRemove).toHaveBeenCalledTimes(1);
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    });

    it.each([
      [
        "with Abbrechen",
        (dialog: HTMLElement) =>
          userEvent.click(
            within(dialog).getByRole("button", { name: "Abbrechen" }),
          ),
      ],
      ["on Escape", () => userEvent.keyboard("{Escape}")],
      ["on a click beside the confirmation", () => clickModalOverlay()],
    ])("does not remove when cancelled %s", async (_, cancel) => {
      const onRemove = vi.fn(async () => ({}));
      renderPanel({ overlays: [fileOverlay], onRemove });
      const dialog = await askToRemove();

      await cancel(dialog);

      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
      expect(onRemove).not.toHaveBeenCalled();
      expect(screen.getByTestId("kml-k2")).toBeInTheDocument();
    });

    it.each([
      [
        "a returned error",
        async () => ({ error: "KML-Overlay nicht gefunden." }),
        "KML-Overlay nicht gefunden.",
      ],
      [
        "a thrown failure",
        async (): Promise<ActionResult> => {
          throw new Error("offline");
        },
        "Das hat nicht geklappt. Bitte erneut versuchen.",
      ],
    ])(
      "shows %s in the open confirmation, not atop the panel",
      async (_, onRemove, message) => {
        renderPanel({ overlays: [fileOverlay], onRemove });
        const dialog = await askToRemove();

        await userEvent.click(confirmButton(dialog));

        const alerts = await screen.findAllByRole("alert");
        expect(alerts).toHaveLength(1);
        expect(within(dialog).getByRole("alert")).toHaveTextContent(message);
        expect(screen.getByTestId("kml-k2")).toBeInTheDocument();
        expect(confirmButton(dialog)).toBeEnabled();
        expect(
          within(dialog).getByRole("button", { name: "Abbrechen" }),
        ).toBeEnabled();
      },
    );

    it("returns focus to the Entfernen button when the first confirmation is cancelled", async () => {
      renderPanel({ overlays: [fileOverlay] });
      await askToRemove();

      await userEvent.keyboard("{Escape}");

      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
      await waitFor(() =>
        expect(
          within(screen.getByTestId("kml-k2")).getByRole("button", {
            name: "Entfernen",
          }),
        ).toHaveFocus(),
      );
    });

    it("stays locked while removing", async () => {
      const onRemove = pending();
      renderPanel({ overlays: [fileOverlay], onRemove });
      const dialog = await askToRemove();

      await userEvent.click(confirmButton(dialog));
      await userEvent.keyboard("{Escape}");
      await clickModalOverlay();
      await userEvent.click(confirmButton(dialog), { pointerEventsCheck: 0 });

      expect(
        within(dialog).getByRole("button", { name: "Abbrechen" }),
      ).toBeDisabled();
      expect(screen.getByRole("dialog")).toBe(dialog);
      expect(onRemove).toHaveBeenCalledTimes(1);
    });
  });

  describe("failures", () => {
    it("shows a failure as a notification titled KML-Ebenen, not atop the panel", async () => {
      renderPanel({
        overlays: [urlOverlay],
        onReload: vi.fn(async () => ({ error: NOT_FOUND })),
      });

      await reload();

      const notification = await screen.findByRole("alert");
      expect(notification).toHaveTextContent("KML-Ebenen");
      expect(notification).toHaveTextContent(NOT_FOUND);
      expect(notificationArea()).toContainElement(notification);
    });

    it.each([
      ["adding a file", "onAddFile", () => addFile()],
      ["adding by URL", "onAddUrl", () => addUrl()],
      [
        "toggling visibility",
        "onToggleVisibility",
        () => userEvent.click(visibilitySwitch(/Laufstrecke/)),
      ],
      ["reloading", "onReload", reload],
    ] as const)(
      "shows the failure when %s throws and leaves the panel usable",
      async (_, prop, perform) => {
        renderPanel({
          overlays: [urlOverlay],
          [prop]: vi.fn(async () => {
            throw new Error("offline");
          }),
        });

        await perform();

        expect(await screen.findByRole("alert")).toHaveTextContent(
          "Das hat nicht geklappt. Bitte erneut versuchen.",
        );
        expect(reloadButton()).toBeEnabled();
        expect(visibilitySwitch(/Laufstrecke/)).toBeChecked();
      },
    );

    it("keeps name and URL in the fields when adding by URL throws", async () => {
      renderPanel({
        onAddUrl: vi.fn(async () => {
          throw new Error("offline");
        }),
      });

      await addUrl();

      await screen.findByRole("alert");
      expect(screen.getByLabelText("Name")).toHaveValue("Strecke");
      expect(screen.getByLabelText("KML-/KMZ-URL")).toHaveValue(
        "https://maps.example/x.kml",
      );
    });
  });

  describe("an earlier notification", () => {
    async function renderWithNotification() {
      renderPanel({
        overlays: [urlOverlay, fileOverlay],
        onReload: vi.fn(async () => ({ error: NOT_FOUND })),
      });
      await reload();
      expect(await screen.findByRole("alert")).toHaveTextContent(NOT_FOUND);
    }

    it.each([
      [
        "the next file is still being read",
        () => addFile(fileStillBeingRead()),
      ],
      ["Entfernen is opened", () => askToRemove()],
    ])("is gone once %s", async (_, perform) => {
      await renderWithNotification();

      await perform();

      await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
    });

    it("gives way to the read failure of the next file", async () => {
      await renderWithNotification();

      const kmz = zipSync({ "liesmich.txt": strToU8("keine KML") });
      await addFile(new File([kmz], "x.kmz"));

      await waitFor(() =>
        expect(screen.getByRole("alert")).toHaveTextContent(
          "Das KMZ-Archiv enthält keine KML-Datei.",
        ),
      );
      expect(screen.getAllByRole("alert")).toHaveLength(1);
    });

    it("stays while typing a name and a URL", async () => {
      await renderWithNotification();

      await userEvent.type(screen.getByLabelText("Name"), "Strecke");
      await userEvent.type(screen.getByLabelText("KML-/KMZ-URL"), "https://x");

      expect(screen.getByRole("alert")).toHaveTextContent(NOT_FOUND);
    });
  });

  describe("while the removal is being confirmed", () => {
    async function failReloadBehindConfirmation() {
      let fail: (result: ActionResult) => void = () => {};
      renderPanel({
        overlays: [urlOverlay, fileOverlay],
        onReload: vi.fn(
          () => new Promise<ActionResult>((resolve) => (fail = resolve)),
        ),
      });
      await reload();
      const dialog = await askToRemove();
      await act(async () => fail({ error: NOT_FOUND }));
      return dialog;
    }

    it("shows a failure that arrives outside the dialog, closable with the dialog open", async () => {
      const dialog = await failReloadBehindConfirmation();

      const notification = await screen.findByRole("alert");
      expect(notification).toHaveTextContent(NOT_FOUND);
      expect(notificationArea()).toContainElement(notification);
      await userEvent.click(
        within(notification).getByRole("button", { name: "Meldung schließen" }),
      );

      await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
      expect(screen.getByRole("dialog")).toBe(dialog);
    });

    it("closes the notification once the removal is confirmed", async () => {
      const dialog = await failReloadBehindConfirmation();

      await userEvent.click(confirmButton(dialog));

      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
      await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
    });
  });

  describe("while an action runs", () => {
    const switches = () => screen.getAllByRole("switch");

    it.each([
      ["reloading", { onReload: pending() }, reload],
      ["adding by URL", { onAddUrl: pending() }, () => addUrl()],
      ["adding a file", { onAddFile: pending() }, () => addFile()],
      ["a file is still being read", {}, () => addFile(fileStillBeingRead())],
    ])(
      "locks every visibility switch and the file input while %s",
      async (_, over: Partial<KmlPanelProps>, perform) => {
        const props = renderPanel({
          overlays: [urlOverlay, fileOverlay],
          ...over,
        });

        await perform();

        await waitFor(() => {
          for (const s of switches()) expect(s).toBeDisabled();
        });
        expect(fileInput()).toBeDisabled();
        await userEvent.click(visibilitySwitch(/Zonen/), {
          pointerEventsCheck: 0,
        });
        expect(props.onToggleVisibility).not.toHaveBeenCalled();
      },
    );

    it("locks the other switch while a visibility switch is pending", async () => {
      const onToggleVisibility = pending();
      renderPanel({
        overlays: [urlOverlay, fileOverlay],
        onToggleVisibility,
      });

      await userEvent.click(visibilitySwitch(/Laufstrecke/));
      await userEvent.click(visibilitySwitch(/Zonen/), {
        pointerEventsCheck: 0,
      });

      expect(visibilitySwitch(/Zonen/)).toBeDisabled();
      expect(onToggleVisibility).toHaveBeenCalledTimes(1);
    });
  });
});
