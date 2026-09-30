import userEvent from "@testing-library/user-event";

/** Klickt neben das oberste offene Modal, also auf sein Overlay. */
export function clickModalOverlay() {
  const overlay = [...document.querySelectorAll(".mantine-Modal-overlay")].at(
    -1,
  );
  if (!overlay) throw new Error("no overlay");
  return userEvent.click(overlay);
}
