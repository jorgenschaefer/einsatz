import { Button } from "@mantine/core";
import { describe, expect, it } from "vitest";
import { render, screen } from "@/test/render";

describe("test harness", () => {
  it("renders a Mantine component through the provider", () => {
    render(<Button>Anmelden</Button>);
    expect(
      screen.getByRole("button", { name: "Anmelden" }),
    ).toBeInTheDocument();
  });
});
