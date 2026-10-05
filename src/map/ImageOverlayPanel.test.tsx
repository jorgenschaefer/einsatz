import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ActionResult } from "@/app/action-result";
import {
  notificationArea,
  render,
  screen,
  waitFor,
  within,
} from "@/test/render";
import {
  type ImageOverlayItem,
  ImageOverlayPanel,
  type ImageOverlayPanelProps,
} from "./ImageOverlayPanel";

function renderPanel(over: Partial<ImageOverlayPanelProps> = {}) {
  const props: ImageOverlayPanelProps = {
    overlays: [],
    onAdd: vi.fn(async () => ({})),
    onToggleVisibility: vi.fn(async () => ({})),
    onEdit: vi.fn(),
    ...over,
  };
  render(<ImageOverlayPanel {...props} />);
  return props;
}

const overlay: ImageOverlayItem = { id: "i1", name: "Lageplan", visible: true };

describe("ImageOverlayPanel", () => {
  const longName = `${"Absperrplan".repeat(7)}.pdf`;

  it("lets a long name without spaces wrap, with switch and button at the top of the row", () => {
    renderPanel({ overlays: [{ ...overlay, name: longName }] });

    const row = screen.getByTestId("image-i1");
    expect(within(row).getByText(longName)).toHaveStyle({
      overflowWrap: "anywhere",
    });
    expect(row.firstElementChild).toHaveStyle({
      "--group-align": "flex-start",
    });
  });

  it("keeps the Bearbeiten button whole beside a long name without spaces", () => {
    renderPanel({ overlays: [{ ...overlay, name: longName }] });

    expect(screen.getByRole("button", { name: "Bearbeiten" })).toHaveStyle({
      flexShrink: "0",
    });
  });

  it("shows an empty hint when there are no image overlays", () => {
    renderPanel();
    expect(screen.getByText(/Keine Bild-Overlays/)).toBeInTheDocument();
  });

  it("adds an image overlay by uploading a file", async () => {
    const onAdd = vi.fn(async () => ({}));
    renderPanel({ onAdd });
    const file = new File(["%PDF-1.4"], "plan.pdf", {
      type: "application/pdf",
    });
    await userEvent.upload(
      screen.getByLabelText(/Bild-Overlay einbinden/),
      file,
    );
    await waitFor(() => expect(onAdd).toHaveBeenCalledWith(file));
  });

  it("toggles visibility of an overlay", async () => {
    const onToggleVisibility = vi.fn(async () => ({}));
    renderPanel({ overlays: [overlay], onToggleVisibility });
    await userEvent.click(screen.getByRole("switch", { name: /Lageplan/ }));
    expect(onToggleVisibility).toHaveBeenCalledWith("i1", false);
  });

  it("opens the editor for an overlay", async () => {
    const onEdit = vi.fn();
    renderPanel({ overlays: [overlay], onEdit });
    await userEvent.click(
      within(screen.getByTestId("image-i1")).getByRole("button", {
        name: "Bearbeiten",
      }),
    );
    expect(onEdit).toHaveBeenCalledWith("i1");
  });

  it("offers no Bearbeiten for a hidden Bild-Overlay, whose handles would not show", () => {
    renderPanel({ overlays: [{ ...overlay, visible: false }] });

    expect(screen.queryByRole("button", { name: "Bearbeiten" })).toBeNull();
  });

  it("renders the inline editor under the overlay being edited and hides its Bearbeiten button", () => {
    renderPanel({
      overlays: [overlay],
      editingId: "i1",
      renderEditor: (o) => <div>editor for {o.name}</div>,
    });
    const row = within(screen.getByTestId("image-i1"));
    expect(row.getByText("editor for Lageplan")).toBeInTheDocument();
    expect(
      row.queryByRole("button", { name: "Bearbeiten" }),
    ).not.toBeInTheDocument();
  });

  describe("when an action does not come back with a result", () => {
    const add = () =>
      userEvent.upload(
        screen.getByLabelText(/Bild-Overlay einbinden/),
        new File(["%PDF-1.4"], "plan.pdf", { type: "application/pdf" }),
      );
    const visibilitySwitch = () =>
      screen.getByRole("switch", { name: /Lageplan/ });
    const toggle = () => userEvent.click(visibilitySwitch());

    const userActions: [
      string,
      "onAdd" | "onToggleVisibility",
      () => Promise<void>,
    ][] = [
      ["adding an image", "onAdd", add],
      ["toggling visibility", "onToggleVisibility", toggle],
    ];

    it.each(userActions)(
      "shows the failure when %s throws and leaves the switch usable",
      async (_, prop, perform) => {
        renderPanel({
          overlays: [overlay],
          [prop]: vi.fn(async () => {
            throw new Error("offline");
          }),
        });

        await perform();

        expect(await screen.findByRole("alert")).toHaveTextContent(
          "Das hat nicht geklappt. Bitte erneut versuchen.",
        );
        expect(visibilitySwitch()).toBeEnabled();
        expect(visibilitySwitch()).toBeChecked();
      },
    );
  });

  it("takes no file while another action runs", async () => {
    renderPanel({
      onAdd: vi.fn(() => new Promise<ActionResult>(() => {})),
    });
    const input = screen.getByLabelText(/Bild-Overlay einbinden/);

    await userEvent.upload(
      input,
      new File(["%PDF-1.4"], "plan.pdf", { type: "application/pdf" }),
    );

    expect(input).toBeDisabled();
  });

  describe("an earlier message", () => {
    const tooBig = "Die Datei ist größer als 20 MB.";
    const upload = () =>
      userEvent.upload(
        screen.getByLabelText(/Bild-Overlay einbinden/),
        new File(["x"], "big.png", { type: "image/png" }),
      );

    it("goes away with Bearbeiten", async () => {
      renderPanel({
        overlays: [overlay],
        onAdd: vi.fn(async () => ({ error: tooBig })),
      });
      await upload();
      expect(await screen.findByRole("alert")).toHaveTextContent(tooBig);

      await userEvent.click(screen.getByRole("button", { name: "Bearbeiten" }));

      expect(screen.queryByRole("alert")).toBeNull();
    });
  });

  it("shows a failure as a notification titled Bild-Overlays, not atop the panel", async () => {
    renderPanel({
      onAdd: vi.fn(async () => ({ error: "Die Datei ist größer als 20 MB." })),
    });

    await userEvent.upload(
      screen.getByLabelText(/Bild-Overlay einbinden/),
      new File(["x"], "big.png", { type: "image/png" }),
    );

    const notification = await screen.findByRole("alert");
    expect(notification).toHaveTextContent("Bild-Overlays");
    expect(notification).toHaveTextContent("Die Datei ist größer als 20 MB.");
    expect(notificationArea()).toContainElement(notification);
  });
});
