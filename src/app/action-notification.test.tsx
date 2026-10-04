import { describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@/test/render";
import {
  beginAction,
  closeActionError,
  dismissActionErrors,
  type NotificationSource,
  showActionError,
} from "./action-notification";

// The dismissals are counted per source for the whole process: each test
// uses a source of its own.
const source = (id: string): NotificationSource => ({ id, title: "Probe" });

async function showError(
  notificationSource: NotificationSource,
  message = "Kaputt.",
) {
  act(() => showActionError(notificationSource, message));
  return (await screen.findByText(message)).closest('[role="alert"]');
}

/** {@link beginAction}, which closes a notification, inside `act`. */
function begin(notificationSource: NotificationSource) {
  let showFailure: (message: string) => void = () => {};
  act(() => {
    showFailure = beginAction(notificationSource);
  });
  return showFailure;
}

const noAlert = () =>
  waitFor(() => expect(screen.queryByRole("alert")).toBeNull());

/** Lets a notification that would still appear do so. */
const settle = () =>
  act(() => new Promise((resolve) => setTimeout(resolve, 50)));

describe("showActionError", () => {
  it("shows the message titled with its source", async () => {
    render(<div />);

    const notification = await showError(source("titled"));

    expect(notification).toHaveTextContent("Probe");
    expect(notification).toHaveTextContent("Kaputt.");
  });

  it("does not close the notification by itself", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      render(<div />);
      await showError(source("stays"));

      await act(() => vi.advanceTimersByTimeAsync(60_000));

      expect(screen.getByRole("alert")).toHaveTextContent("Kaputt.");
    } finally {
      vi.useRealTimers();
    }
  });

  it("replaces an earlier notification of the same source", async () => {
    render(<div />);
    await showError(source("twice"), "Zuerst.");

    act(() => showActionError(source("twice"), "Danach."));

    await waitFor(() => expect(screen.getAllByRole("alert")).toHaveLength(1));
    expect(screen.getByRole("alert")).toHaveTextContent("Danach.");
  });

  it("closes the notification with its close button", async () => {
    render(<div />);
    await showError(source("button"));

    await act(async () =>
      screen.getByRole("button", { name: "Meldung schließen" }).click(),
    );

    await noAlert();
  });
});

describe("closeActionError", () => {
  it("closes the notification of its source only", async () => {
    render(<div />);
    await showError({ id: "other", title: "Andere" }, "Woanders.");
    await showError(source("own"));

    act(() => closeActionError(source("own")));

    await waitFor(() => expect(screen.getAllByRole("alert")).toHaveLength(1));
    expect(screen.getByRole("alert")).toHaveTextContent("Andere");
  });
});

describe("beginAction", () => {
  it("closes the earlier notification of its source", async () => {
    render(<div />);
    await showError(source("begin"));

    begin(source("begin"));

    await noAlert();
  });

  it("leaves another source's notification standing", async () => {
    render(<div />);
    await showError({ id: "standing", title: "Andere" });

    begin(source("starting"));
    await settle();

    expect(screen.getByRole("alert")).toHaveTextContent("Andere");
  });

  it("hands back what shows the action's error", async () => {
    render(<div />);
    const showFailure = begin(source("shown"));

    act(() => showFailure("Kaputt."));

    expect(await screen.findByRole("alert")).toHaveTextContent("Kaputt.");
  });
});

describe("dismissActionErrors", () => {
  it("closes the notification of its source", async () => {
    render(<div />);
    await showError(source("dismissed"));

    act(() => dismissActionErrors(source("dismissed")));

    await noAlert();
  });

  it("drops the error of an action that began before and fails afterwards", async () => {
    render(<div />);
    const showFailure = begin(source("left"));

    act(() => dismissActionErrors(source("left")));
    act(() => showFailure("Kaputt."));
    await settle();

    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("keeps the error of another source's action", async () => {
    render(<div />);
    const showFailure = begin(source("kept"));

    act(() => dismissActionErrors(source("elsewhere")));
    act(() => showFailure("Kaputt."));

    expect(await screen.findByRole("alert")).toHaveTextContent("Kaputt.");
  });

  it("lets an action that begins afterwards show its error", async () => {
    render(<div />);
    act(() => dismissActionErrors(source("back")));

    const showFailure = begin(source("back"));
    act(() => showFailure("Kaputt."));

    expect(await screen.findByRole("alert")).toHaveTextContent("Kaputt.");
  });
});
