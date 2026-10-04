import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ActionResult } from "@/app/action-result";
import { render, screen, waitFor, within } from "@/test/render";
import { LogoutOtherSessions } from "./LogoutOtherSessions";

const DONE = "Alle anderen Sitzungen wurden beendet.";

async function askToLogOutEverywhere() {
  await userEvent.click(
    screen.getByRole("button", { name: "Überall abmelden" }),
  );
  return screen.findByRole("dialog", {
    name: "Alle anderen Sitzungen beenden?",
  });
}

describe("LogoutOtherSessions", () => {
  it("ends the other sessions only after confirming, then says so", async () => {
    const action = vi.fn(async (): Promise<ActionResult> => ({}));
    render(<LogoutOtherSessions action={action} />);

    const dialog = await askToLogOutEverywhere();
    expect(action).not.toHaveBeenCalled();
    expect(screen.queryByText(DONE)).toBeNull();
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Sitzungen beenden" }),
    );

    expect(await screen.findByText(DONE)).toBeVisible();
    expect(action).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("does not say so when ending the other sessions fails", async () => {
    render(<LogoutOtherSessions action={async () => ({ error: "Kaputt." })} />);

    const dialog = await askToLogOutEverywhere();
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Sitzungen beenden" }),
    );

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "Kaputt.",
    );
    expect(screen.queryByText(DONE)).toBeNull();
  });

  it("ends nothing when the question is cancelled", async () => {
    const action = vi.fn(async (): Promise<ActionResult> => ({}));
    render(<LogoutOtherSessions action={action} />);

    const dialog = await askToLogOutEverywhere();
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Abbrechen" }),
    );

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(action).not.toHaveBeenCalled();
    expect(screen.queryByText(DONE)).toBeNull();
  });
});
