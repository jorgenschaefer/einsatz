import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  uploadImageOverlay,
  uploadKmlFile,
  uploadReplacementImage,
} from "./uploads";

const fetchMock = vi.fn<typeof fetch>();
const assign = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  assign.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("location", { assign });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const answer = (status: number, body: string, contentType?: string) =>
  fetchMock.mockResolvedValueOnce(
    new Response(body, {
      status,
      headers: contentType ? { "content-type": contentType } : {},
    }),
  );
const answerJson = (status: number, body: unknown) =>
  answer(status, JSON.stringify(body), "application/json");

const sent = () => {
  const [url, init] = fetchMock.mock.calls[0];
  return { url, method: init?.method, form: init?.body as FormData };
};

const plan = new File(["%PNG"], "plan.png", { type: "image/png" });
const view = { lat: 53.55, lng: 9.99, widthM: 4000, heightM: 3000 };

const uploads = [
  {
    name: "uploadKmlFile",
    call: () => uploadKmlFile("op-1", "Abschnitte", "<kml/>"),
    fallback: "KML konnte nicht geladen werden.",
  },
  {
    name: "uploadImageOverlay",
    call: () => uploadImageOverlay("op-1", plan, view),
    fallback: "Das Bild konnte nicht eingebunden werden.",
  },
  {
    name: "uploadReplacementImage",
    call: () => uploadReplacementImage("op-1", "ov-1", plan),
    fallback: "Das Bild konnte nicht eingebunden werden.",
  },
];

describe("uploadKmlFile", () => {
  it("posts the name and the KML as a file to the Einsatz's KML route", async () => {
    answerJson(200, {});

    await uploadKmlFile("op-1", "Abschnitte", "<kml>ä</kml>");

    const { url, method, form } = sent();
    expect([url, method]).toEqual(["/operations/op-1/kml", "POST"]);
    expect(form.get("name")).toBe("Abschnitte");
    expect(await (form.get("content") as File).text()).toBe("<kml>ä</kml>");
  });
});

describe("uploadImageOverlay", () => {
  it("posts the file and the view as JSON to the Einsatz's overlay route", async () => {
    answerJson(200, {});

    await uploadImageOverlay("op-1", plan, view);

    const { url, method, form } = sent();
    expect([url, method]).toEqual(["/operations/op-1/overlays", "POST"]);
    expect((form.get("file") as File).name).toBe("plan.png");
    expect(JSON.parse(form.get("view") as string)).toEqual(view);
  });
});

describe("uploadReplacementImage", () => {
  it("puts the file to the overlay's route", async () => {
    answerJson(200, {});

    await uploadReplacementImage("op-1", "ov-1", plan);

    const { url, method, form } = sent();
    expect([url, method]).toEqual(["/operations/op-1/overlays/ov-1", "PUT"]);
    expect((form.get("file") as File).name).toBe("plan.png");
  });
});

describe.each(uploads)("$name", ({ call, fallback }) => {
  it("returns no error on success", async () => {
    answerJson(200, {});

    expect(await call()).toEqual({});
  });

  it.each([400, 413, 500])(
    "returns the route's message on %i",
    async (status) => {
      answerJson(status, { error: "Die Datei ist größer als 20 MB." });

      expect(await call()).toEqual({
        error: "Die Datei ist größer als 20 MB.",
      });
    },
  );

  it("returns the fallback message for an answer that is not JSON", async () => {
    answer(502, "<html>Bad Gateway</html>", "text/html");

    expect(await call()).toEqual({ error: fallback });
  });

  it("returns the fallback message for a failure without a message", async () => {
    answerJson(500, {});

    expect(await call()).toEqual({ error: fallback });
  });

  it("goes to the login page without a session", async () => {
    answer(401, "");

    void call();

    await vi.waitFor(() => expect(assign).toHaveBeenCalledWith("/login"));
  });
});
