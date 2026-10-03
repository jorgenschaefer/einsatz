import { setTimeout as realDelay } from "node:timers/promises";
import { afterEach, beforeEach, expect, vi } from "vitest";

/** Long enough for any Live-Verbindung to reach its next heartbeat. */
export const WITHIN_A_HEARTBEAT = 30_000;

export interface LiveConnection {
  ended: () => boolean;
  close: () => Promise<void>;
}

const openReaders: ReadableStreamDefaultReader<Uint8Array>[] = [];

/**
 * Runs the stream clock on fake timers for each test of the calling
 * `describe` and closes every connection `expectAccepted` opened when the
 * test ends. The database keeps real timers.
 */
export function useStreamClock(): void {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "Date"] });
  });
  afterEach(async () => {
    for (const reader of openReaders.splice(0)) await reader.cancel();
    vi.useRealTimers();
  });
}

/**
 * Expects the route to have accepted the Live-Verbindung, then holds it open
 * and reads it in the background until it ends.
 */
export function expectAccepted(res: Response): LiveConnection {
  expect(res.status).toBe(200);
  const reader = res.body!.getReader();
  openReaders.push(reader);
  let ended = false;
  void (async () => {
    while (!(await reader.read()).done);
    ended = true;
  })();
  return { ended: () => ended, close: () => reader.cancel() };
}

/** Lets `ms` of stream time pass and waits for the real database work of the access checks. */
export async function elapse(ms: number): Promise<void> {
  await vi.advanceTimersByTimeAsync(ms);
  await realDelay(150);
}
