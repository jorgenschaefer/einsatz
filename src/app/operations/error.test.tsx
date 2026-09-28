import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@/test/render";
import OperationsError from "./error";

describe("OperationsError", () => {
  it("shows a generic load error and lets the user retry", async () => {
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
    const reset = vi.fn();
    const boom = new Error("boom");
    render(<OperationsError error={boom} reset={reset} />);
    expect(
      screen.getByText(/Seite konnte nicht geladen werden/i),
    ).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: /Erneut versuchen/ }),
    );
    expect(reset).toHaveBeenCalled();
    expect(errorLog).toHaveBeenCalledWith(boom);
    errorLog.mockRestore();
  });
});
