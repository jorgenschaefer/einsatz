import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@/test/render";
import OperationsError from "./error";

describe("OperationsError", () => {
  it("shows a generic load error and lets the user retry", async () => {
    const reset = vi.fn();
    render(<OperationsError error={new Error("boom")} reset={reset} />);
    expect(
      screen.getByText(/Seite konnte nicht geladen werden/i),
    ).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: /Erneut versuchen/ }),
    );
    expect(reset).toHaveBeenCalled();
  });
});
