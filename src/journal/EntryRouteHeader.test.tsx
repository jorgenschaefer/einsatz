import { describe, expect, it } from "vitest";
import { NO_ROUTE } from "@/journal/entry-route";
import { render, screen } from "@/test/render";
import { EntryRouteHeader } from "./EntryRouteHeader";

const ROUTED = { sender: "UHSt 2", recipient: "EAL", channel: "Funk" };

function setup(...[props]: Parameters<typeof EntryRouteHeader>) {
  render(
    <div data-testid="entry">
      <EntryRouteHeader {...props} />
    </div>,
  );
  return screen.getByTestId("entry");
}

describe("EntryRouteHeader", () => {
  it.each([
    ["UHSt 2", "EAL", "Funk", "Von UHSt 2 an EAL · Funk"],
    [null, "EAL", "Telefon", "An EAL · Telefon"],
    ["UHSt 2", null, null, "Von UHSt 2"],
    [null, null, "Funk", "Funk"],
  ])(
    "shows Von %s, An %s, Weg %s as %s",
    (sender, recipient, channel, header) => {
      expect(setup({ route: { sender, recipient, channel } }).textContent).toBe(
        header,
      );
    },
  );

  it("shows nothing without Von, An and Weg", () => {
    expect(setup({ route: NO_ROUTE })).toBeEmptyDOMElement();
  });

  it("strikes the whole header through when told to", () => {
    const header = setup({ route: ROUTED, struck: true });

    expect(header.querySelector("del")).toHaveTextContent(
      "Von UHSt 2 an EAL · Funk",
    );
  });

  it("is not struck through by default", () => {
    expect(setup({ route: ROUTED }).querySelector("del")).toBeNull();
  });
});
