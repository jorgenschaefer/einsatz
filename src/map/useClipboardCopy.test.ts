import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@/test/render";
import { useClipboardCopy } from "./useClipboardCopy";

const writeText = vi.fn();

const provideClipboard = () =>
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText },
  });

afterEach(() => {
  vi.useRealTimers();
  writeText.mockReset();
  delete (navigator as { clipboard?: unknown }).clipboard;
});

describe("useClipboardCopy", () => {
  it("is idle before anything is copied", () => {
    expect(setup().current.status).toBe("idle");
  });

  it("writes the text and reports it copied", async () => {
    writeText.mockResolvedValue(undefined);
    provideClipboard();
    const result = setup();

    await copyWith(result, "https://example.org/device/t");

    expect(writeText).toHaveBeenCalledWith("https://example.org/device/t");
    expect(result.current.status).toBe("copied");
  });

  it("falls back to idle 2 s after copying", async () => {
    vi.useFakeTimers();
    writeText.mockResolvedValue(undefined);
    provideClipboard();
    const result = setup();
    await copyWith(result);

    await act(() => vi.advanceTimersByTimeAsync(1999));
    expect(result.current.status).toBe("copied");
    await act(() => vi.advanceTimersByTimeAsync(1));
    expect(result.current.status).toBe("idle");
  });

  it("reports failed without the Clipboard API", async () => {
    const result = setup();

    await copyWith(result);

    expect(result.current.status).toBe("failed");
  });

  it("reports failed when the browser rejects the write", async () => {
    writeText.mockRejectedValue(new Error("denied"));
    provideClipboard();
    const result = setup();

    await copyWith(result);

    expect(result.current.status).toBe("failed");
  });

  it("keeps failed until the next attempt replaces it", async () => {
    vi.useFakeTimers();
    const result = setup();
    await copyWith(result);

    await act(() => vi.advanceTimersByTimeAsync(10_000));
    expect(result.current.status).toBe("failed");

    writeText.mockResolvedValue(undefined);
    provideClipboard();
    await copyWith(result);
    expect(result.current.status).toBe("copied");
  });
});

function setup() {
  return renderHook(() => useClipboardCopy()).result;
}

async function copyWith(result: ReturnType<typeof setup>, text = "link") {
  await act(() => result.current.copy(text));
}
