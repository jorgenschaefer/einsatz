import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  notificationArea,
  routerRefresh,
  screen,
  waitFor,
  within,
} from "@/test/render";
import { fakeMapAdapterFactory } from "./adapter.fixtures";
import { anImageOverlay } from "./map-objects.fixtures";
import {
  openImageEditor,
  openPanel,
  renderWorkspace,
} from "./SituationWorkspace.fixtures";

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  routerRefresh.mockClear();
  fetchMock.mockReset().mockResolvedValue(Response.json({}));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const sent = async () => {
  await waitFor(() => expect(fetchMock).toHaveBeenCalled());
  const [url, init] = fetchMock.mock.calls[0];
  return { url, method: init?.method, form: init?.body as FormData };
};

const uploadPlan = async () =>
  userEvent.upload(
    screen.getByLabelText(/Bild-Overlay einbinden/),
    new File(["%PNG"], "plan.png", { type: "image/png" }),
  );

describe("uploading a Bild-Overlay", () => {
  it("sends the file and the map area the uploader sees, then refreshes", async () => {
    const extent = { lat: 53.55, lng: 9.99, widthM: 7200, heightM: 5400 };
    const { factory } = fakeMapAdapterFactory(undefined, extent);
    renderWorkspace({ factory });

    await openPanel("Ebenen");
    await uploadPlan();

    const { url, method, form } = await sent();
    expect([url, method]).toEqual(["/operations/op-x/overlays", "POST"]);
    expect((form.get("file") as File).name).toBe("plan.png");
    expect(JSON.parse(form.get("view") as string)).toEqual(extent);
    await waitFor(() => expect(routerRefresh).toHaveBeenCalled());
  });

  it("shows the route's message and does not refresh when the upload is refused", async () => {
    fetchMock.mockResolvedValue(
      Response.json(
        { error: "Die Datei ist größer als 20 MB." },
        { status: 413 },
      ),
    );
    renderWorkspace();

    await openPanel("Ebenen");
    await uploadPlan();

    const notification = await within(notificationArea()).findByRole("alert");
    expect(notification).toHaveTextContent("Die Datei ist größer als 20 MB.");
    expect(routerRefresh).not.toHaveBeenCalled();
  });

  it("asks to try again and uploads nothing before the map has loaded", async () => {
    // Der echte Leaflet-Adapter wird dynamisch geladen; hängt das Laden, gibt es
    // noch keine Karte und damit keinen Ausschnitt.
    vi.doMock("./leaflet-adapter", () => new Promise(() => {}));
    try {
      renderWorkspace({ factory: undefined });

      await openPanel("Ebenen");
      await uploadPlan();

      const notification = await within(notificationArea()).findByRole("alert");
      expect(notification).toHaveTextContent("Bild-Overlays");
      expect(notification).toHaveTextContent(
        "Die Karte lädt noch. Bitte erneut versuchen.",
      );
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      vi.doUnmock("./leaflet-adapter");
    }
  });
});

describe("replacing a Bild-Overlay's file", () => {
  it("sends the file to the overlay, keeps editing and refreshes", async () => {
    renderWorkspace({ imageOverlays: [anImageOverlay] });
    await openImageEditor();

    await userEvent.upload(
      screen.getByLabelText("Datei ersetzen"),
      new File(["%PDF-1.4"], "neu.pdf", { type: "application/pdf" }),
    );

    const { url, method, form } = await sent();
    expect([url, method]).toEqual(["/operations/op-x/overlays/i1", "PUT"]);
    expect((form.get("file") as File).name).toBe("neu.pdf");
    await waitFor(() => expect(routerRefresh).toHaveBeenCalled());
    expect(
      screen.getByRole("toolbar", { name: "Bild-Overlay bearbeiten" }),
    ).toBeInTheDocument();
  });
});

describe("adding a KML file", () => {
  it("sends the file's name and KML to the KML route, then refreshes", async () => {
    renderWorkspace();
    await openPanel("Ebenen");

    await userEvent.upload(
      screen.getByLabelText("KML-/KMZ-Datei einbinden"),
      new File(["<kml><Document/></kml>"], "abschnitte.kml", {
        type: "application/vnd.google-earth.kml+xml",
      }),
    );

    const { url, method, form } = await sent();
    expect([url, method]).toEqual(["/operations/op-x/kml", "POST"]);
    expect(form.get("name")).toBe("abschnitte.kml");
    expect(await (form.get("content") as File).text()).toBe(
      "<kml><Document/></kml>",
    );
    await waitFor(() => expect(routerRefresh).toHaveBeenCalled());
  });
});
