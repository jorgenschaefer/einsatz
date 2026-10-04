import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { publishOperationChanged } from "@/server/events/operation-events";
import { liveEventsFor } from "./live-events";

describe("liveEventsFor", () => {
  it("returns what the act returned and the live events of the Einsatz meanwhile", async () => {
    const operationId = randomUUID();

    expect(
      await liveEventsFor(operationId, async () => {
        publishOperationChanged(operationId);
        publishOperationChanged(randomUUID());
        return "done";
      }),
    ).toEqual({ result: "done", events: 1 });
  });
});
