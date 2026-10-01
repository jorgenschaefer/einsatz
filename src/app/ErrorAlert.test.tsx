import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@/test/render";
import { ErrorAlert } from "./ErrorAlert";

describe("ErrorAlert", () => {
  it("shows nothing without an error", () => {
    render(<ErrorAlert error={null} onClose={vi.fn()} />);

    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("shows the error with an × that closes it", async () => {
    const onClose = vi.fn();
    render(<ErrorAlert error="Das hat nicht geklappt." onClose={onClose} />);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Das hat nicht geklappt.",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Meldung schließen" }),
    );
    expect(onClose).toHaveBeenCalled();
  });
});
