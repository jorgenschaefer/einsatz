import "@testing-library/jest-dom/vitest";
import { cleanup, configure } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// Portale (Mantine Menu/Modal) können unter paralleler Last träger erscheinen;
// der knappe 1-s-Default von findBy* flakte dann. Großzügiger asyncUtilTimeout.
configure({ asyncUtilTimeout: 15000 });

afterEach(() => {
  cleanup();
});

// Mantine components rely on browser APIs jsdom does not implement.
if (typeof window !== "undefined") {
  window.matchMedia =
    window.matchMedia ||
    ((query: string) =>
      ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }) as unknown as MediaQueryList);

  window.scrollTo = window.scrollTo || vi.fn();

  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  window.ResizeObserver =
    window.ResizeObserver ||
    (ResizeObserverStub as unknown as typeof ResizeObserver);
}
