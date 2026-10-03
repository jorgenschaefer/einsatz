import { subscribeOperation } from "@/server/events/operation-events";

/** How many live events the Führungsansichten of `operationId` receive while `act` runs. */
export async function liveEventsFor(
  operationId: string,
  act: () => Promise<unknown>,
): Promise<number> {
  let events = 0;
  const unsubscribe = subscribeOperation(operationId, () => {
    events += 1;
  });
  try {
    await act();
  } finally {
    unsubscribe();
  }
  return events;
}
