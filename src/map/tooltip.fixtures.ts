import { expect } from "vitest";

/**
 * The tooltip shows `label` verbatim as text: at most one element holds it,
 * and nothing in the label became an element of its own.
 */
export function expectTooltipText(tooltip: HTMLElement | null, label: string) {
  expect(tooltip).not.toBeNull();
  expect(tooltip?.textContent).toBe(label);
  expect(tooltip?.querySelectorAll("*").length).toBeLessThanOrEqual(1);
}
