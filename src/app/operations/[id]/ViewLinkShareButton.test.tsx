import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@/test/render";
import {
  ViewLinkShareButton,
  type ViewLinkShareButtonProps,
} from "./ViewLinkShareButton";

function setup(over: Partial<ViewLinkShareButtonProps> = {}) {
  const props: ViewLinkShareButtonProps = {
    links: [],
    onCreate: vi.fn(),
    onDelete: vi.fn(),
    ...over,
  };
  render(<ViewLinkShareButton {...props} />);
  return props;
}

describe("ViewLinkShareButton", () => {
  it("opens the share panel only after the Teilen button is clicked", async () => {
    setup();
    expect(screen.queryByLabelText(/Bezeichnung/i)).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: /Teilen/i }));
    expect(await screen.findByLabelText(/Bezeichnung/i)).toBeInTheDocument();
  });

  it("shows existing view links inside the panel", async () => {
    setup({ links: [{ id: "1", label: "Leitstelle", token: "tok-a" }] });
    await userEvent.click(screen.getByRole("button", { name: /Teilen/i }));
    expect(await screen.findByText("Leitstelle")).toBeInTheDocument();
  });
});
