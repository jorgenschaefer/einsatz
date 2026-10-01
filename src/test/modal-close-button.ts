import userEvent from "@testing-library/user-event";

/** Klickt das „×“ oben rechts im Modal; Mantine gibt ihm keinen Namen. */
export function clickModalCloseButton(dialog: HTMLElement) {
  const close = dialog.querySelector(".mantine-Modal-close");
  if (!close) throw new Error("no close button");
  return userEvent.click(close);
}
