import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type MockInstance,
  vi,
} from "vitest";
import { act, render, screen } from "@/test/render";
import { useScrollToEnd } from "./useScrollToEnd";

let scrollToEnd: () => void;

/** Das ETB, auf das Listenende und Neuer Eintrag reduziert. */
function Journal({
  visible = true,
  lastEntryId = "e1",
}: {
  visible?: boolean;
  lastEntryId?: string;
}) {
  const scroll = useScrollToEnd(visible, lastEntryId);
  scrollToEnd = scroll.scrollToEnd;
  return (
    <>
      <div data-testid="list-end" ref={scroll.endRef} />
      <div data-testid="new-entry" ref={scroll.newEntryRef} />
    </>
  );
}

describe("useScrollToEnd", () => {
  let scrollIntoView: MockInstance<Element["scrollIntoView"]>;
  /** Meldet Beobachtungen des Listenendes, älteste zuerst, in einem Aufruf. */
  let reportEndVisible: (...visible: boolean[]) => void;

  beforeEach(() => {
    scrollIntoView = vi.spyOn(Element.prototype, "scrollIntoView");
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        constructor(callback: IntersectionObserverCallback) {
          reportEndVisible = (...visible) =>
            act(() =>
              callback(
                visible.map(
                  (isIntersecting) =>
                    ({ isIntersecting }) as IntersectionObserverEntry,
                ),
                this as unknown as IntersectionObserver,
              ),
            );
        }
        observe() {}
        disconnect() {}
      },
    );
  });

  afterEach(() => {
    scrollIntoView.mockRestore();
    vi.unstubAllGlobals();
  });

  const expectScrolledToEnd = () => {
    expect(scrollIntoView.mock.contexts).toEqual([
      screen.getByTestId("list-end"),
      screen.getByTestId("new-entry"),
    ]);
    expect(scrollIntoView).toHaveBeenCalledWith({ block: "end" });
  };

  // Am Handy scrollt das ganze ETB; unter der Liste steht Neuer Eintrag.
  it("shows the end of the list, then Neuer Eintrag below it, when it opens", () => {
    render(<Journal />);

    expectScrolledToEnd();
  });

  it("shows the end of the list once it becomes visible", () => {
    const { rerender } = render(<Journal visible={false} />);
    expect(scrollIntoView).not.toHaveBeenCalled();

    rerender(<Journal visible />);

    expectScrolledToEnd();
  });

  it("scrolls to the end on scrollToEnd, even when scrolled up", () => {
    render(<Journal />);
    reportEndVisible(false);
    scrollIntoView.mockClear();

    act(() => scrollToEnd());

    expectScrolledToEnd();
  });

  it("follows the next entry after scrollToEnd, before the end is reported in view", () => {
    const { rerender } = render(<Journal />);
    reportEndVisible(false);
    act(() => scrollToEnd());
    scrollIntoView.mockClear();

    rerender(<Journal lastEntryId="e2" />);

    expectScrolledToEnd();
  });

  it("follows a new entry while the end of the list is in view", () => {
    const { rerender } = render(<Journal />);
    reportEndVisible(true);
    scrollIntoView.mockClear();

    rerender(<Journal lastEntryId="e2" />);

    expectScrolledToEnd();
  });

  it("goes by the newest of several observations of the end", () => {
    const { rerender } = render(<Journal />);
    reportEndVisible(false, true);
    scrollIntoView.mockClear();

    rerender(<Journal lastEntryId="e2" />);

    expectScrolledToEnd();
  });

  it("stays put for a new entry while scrolled up", () => {
    const { rerender } = render(<Journal />);
    reportEndVisible(false);
    scrollIntoView.mockClear();

    rerender(<Journal lastEntryId="e2" />);

    expect(scrollIntoView).not.toHaveBeenCalled();
  });
});
