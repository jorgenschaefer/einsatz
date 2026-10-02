import { expect } from "vitest";

/** Every closed 1-second span holds at most two notifications. */
export function assertAtMostTwoPerSecond(times: number[]) {
  for (let i = 0; i + 2 < times.length; i++) {
    expect(times[i + 2] - times[i]).toBeGreaterThan(1000);
  }
}

export function assertLastChangeArrivesWithinOneSecond(
  notified: number[],
  publishTimes: number[],
) {
  const lastChange = publishTimes[publishTimes.length - 1];
  const lastNotification = notified[notified.length - 1];
  expect(lastNotification).toBeGreaterThanOrEqual(lastChange);
  expect(lastNotification - lastChange).toBeLessThanOrEqual(1000);
}
