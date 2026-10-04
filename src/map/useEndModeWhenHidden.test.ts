import { describe, expect, it, vi } from "vitest";
import { renderHook } from "@/test/render";
import { useEndModeWhenHidden } from "./useEndModeWhenHidden";

function renderShown(mapShown: boolean) {
  const endMode = vi.fn();
  const { rerender } = renderHook(
    (shown: boolean) => useEndModeWhenHidden(shown, endMode),
    { initialProps: mapShown },
  );
  return { endMode, rerender };
}

describe("useEndModeWhenHidden", () => {
  it("ends the mode once each time the map is hidden", () => {
    const { endMode, rerender } = renderShown(true);

    rerender(false);
    rerender(false);
    expect(endMode).toHaveBeenCalledTimes(1);

    rerender(true);
    rerender(false);
    expect(endMode).toHaveBeenCalledTimes(2);
  });

  it("leaves the mode alone while the map stays shown and when it is shown again", () => {
    const { endMode, rerender } = renderShown(false);

    rerender(true);
    rerender(true);

    expect(endMode).not.toHaveBeenCalled();
  });
});
