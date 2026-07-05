import { describe, expect, it } from "vitest";
import { render, screen } from "@/test/render";
import { DeviceClosed } from "./DeviceClosed";

describe("DeviceClosed", () => {
  it("shows a neutral message that names no reason", () => {
    render(<DeviceClosed />);
    expect(screen.getByText(/nicht mehr aktiv/i)).toBeInTheDocument();
    // grundunabhängig: nennt keinen konkreten Wegfall-Grund
    expect(screen.queryByText(/abgeschlossen|gelöscht|generiert/i)).toBeNull();
  });
});
