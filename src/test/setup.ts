import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

afterEach(() => {
  cleanup();
  localStorage.clear();
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

  Element.prototype.scrollIntoView =
    Element.prototype.scrollIntoView || (() => {});

  class IntersectionObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  window.IntersectionObserver =
    window.IntersectionObserver ||
    (IntersectionObserverStub as unknown as typeof IntersectionObserver);

  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  window.ResizeObserver =
    window.ResizeObserver ||
    (ResizeObserverStub as unknown as typeof ResizeObserver);
}
