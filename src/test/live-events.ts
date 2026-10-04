import { subscribeOperation } from "@/server/events/operation-events";

/**
 * Runs `act` and returns what it returned, with how many live events the
 * Führungsansichten of `operationId` received meanwhile.
 */
export async function liveEventsFor<T>(
  operationId: string,
  act: () => Promise<T>,
): Promise<{ result: T; events: number }> {
  let events = 0;
  const unsubscribe = subscribeOperation(operationId, () => {
    events += 1;
  });
  try {
    const result = await act();
    return { result, events };
  } finally {
    unsubscribe();
  }
}
