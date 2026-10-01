import type { ComponentProps } from "react";
import { beforeEach, describe, expect, it } from "vitest";
import { render, waitFor } from "@/test/render";
import { fakeMapAdapterFactory } from "./adapter.fixtures";
import { SituationMap } from "./SituationMap";

const HIT = { lat: 53.55, lng: 9.99 };

function renderMap(over: Partial<ComponentProps<typeof SituationMap>> = {}) {
  const fake = fakeMapAdapterFactory();
  const base = {
    operationId: "op-x",
    operationDefaultView: null,
    tileUrl: "t",
    attribution: "a",
    factory: fake.factory,
  };
  const { rerender } = render(<SituationMap {...base} {...over} />);
  const update = (next: Partial<ComponentProps<typeof SituationMap>>) =>
    rerender(<SituationMap {...base} {...next} />);
  return { ...fake, update };
}

describe("SituationMap Suchtreffer", () => {
  beforeEach(() => localStorage.clear());

  it("draws the Suchtreffer", async () => {
    const { drawn } = renderMap({ searchHit: HIT });
    await waitFor(() => expect(drawn.searchHit).toEqual(HIT));
  });

  it("moves it to the next Suchtreffer", async () => {
    const next = { lat: 53.56, lng: 10.01 };
    const { drawn, update } = renderMap({ searchHit: HIT });
    await waitFor(() => expect(drawn.searchHit).toEqual(HIT));
    update({ searchHit: next });
    await waitFor(() => expect(drawn.searchHit).toEqual(next));
  });

  it("removes it when the Suchtreffer is gone", async () => {
    const { drawn, update } = renderMap({ searchHit: HIT });
    await waitFor(() => expect(drawn.searchHit).toEqual(HIT));
    update({ searchHit: null });
    await waitFor(() => expect(drawn.searchHit).toBeNull());
  });

  it("leaves it alone when changes of other users arrive", async () => {
    const { adapter, drawn, update } = renderMap({ searchHit: HIT });
    await waitFor(() => expect(drawn.searchHit).toEqual(HIT));
    update({
      searchHit: HIT,
      symbols: [{ id: "s1", lat: 1, lng: 2, iconUrl: "data:," }],
      areas: [],
    });
    await waitFor(() => expect(adapter.setMarker).toHaveBeenCalled());
    expect(adapter.setSearchHit).toHaveBeenCalledTimes(1);
    expect(adapter.clearSearchHit).not.toHaveBeenCalled();
  });

  it("draws none on a freshly loaded map", async () => {
    const { captured, drawn } = renderMap();
    await waitFor(() => expect(captured.options).toBeDefined());
    expect(drawn.searchHit).toBeNull();
  });
});
