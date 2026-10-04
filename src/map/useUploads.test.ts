import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Providers, renderHook, routerRefresh } from "@/test/render";
import { useUploads } from "./useUploads";

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  routerRefresh.mockClear();
  fetchMock.mockReset().mockResolvedValue(Response.json({}));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const plan = new File(["%PNG"], "plan.png", { type: "image/png" });
const view = { lat: 53.55, lng: 9.99, widthM: 4000, heightM: 3000 };

function renderUploads() {
  return renderHook(() => useUploads("op-x"), { wrapper: Providers }).result
    .current;
}

const sentTo = () => {
  const [url, init] = fetchMock.mock.calls[0];
  return [url, init?.method];
};

describe("useUploads", () => {
  it.each([
    [
      "a KML file",
      (uploads: ReturnType<typeof useUploads>) =>
        uploads.onAddKmlFile("abschnitte.kml", "<kml/>"),
      ["/operations/op-x/kml", "POST"],
    ],
    [
      "a Bild-Overlay",
      (uploads: ReturnType<typeof useUploads>) =>
        uploads.onAddImage(plan, view),
      ["/operations/op-x/overlays", "POST"],
    ],
    [
      "a Bild-Overlay's new file",
      (uploads: ReturnType<typeof useUploads>) =>
        uploads.onReplaceImage("i1", plan),
      ["/operations/op-x/overlays/i1", "PUT"],
    ],
  ])(
    "sends %s to the Einsatz's route, then refreshes the page",
    async (_, upload, route) => {
      const result = await upload(renderUploads());

      expect(result).toEqual({});
      expect(sentTo()).toEqual(route);
      expect(routerRefresh).toHaveBeenCalledTimes(1);
    },
  );

  it("hands back the route's message and does not refresh when the upload is refused", async () => {
    fetchMock.mockResolvedValue(
      Response.json(
        { error: "Die Datei ist größer als 20 MB." },
        { status: 413 },
      ),
    );

    const result = await renderUploads().onAddImage(plan, view);

    expect(result).toEqual({ error: "Die Datei ist größer als 20 MB." });
    expect(routerRefresh).not.toHaveBeenCalled();
  });

  it("passes on an upload that throws, without refreshing", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));

    await expect(renderUploads().onReplaceImage("i1", plan)).rejects.toThrow(
      "offline",
    );
    expect(routerRefresh).not.toHaveBeenCalled();
  });
});
