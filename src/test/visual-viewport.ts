import { vi } from "vitest";

/**
 * Stubbt `window.visualViewport` (jsdom kennt es nicht) mit der gegebenen
 * Höhe. `resizeTo` ändert die Höhe und feuert `resize` wie der Browser, wenn
 * die Bildschirmtastatur auf- oder zugeht. Mit `vi.unstubAllGlobals()` wieder
 * entfernen.
 */
export function stubVisualViewport(height: number) {
  const listeners = new Set<EventListenerOrEventListenerObject>();
  const viewport = new EventTarget() as EventTarget & { height: number };
  viewport.height = height;
  const add = viewport.addEventListener.bind(viewport);
  const remove = viewport.removeEventListener.bind(viewport);
  viewport.addEventListener = (type, listener, options) => {
    if (listener) listeners.add(listener);
    add(type, listener, options);
  };
  viewport.removeEventListener = (type, listener, options) => {
    if (listener) listeners.delete(listener);
    remove(type, listener, options);
  };
  vi.stubGlobal("visualViewport", viewport);
  return {
    resizeTo(nextHeight: number) {
      viewport.height = nextHeight;
      viewport.dispatchEvent(new Event("resize"));
    },
    listenerCount: () => listeners.size,
  };
}
