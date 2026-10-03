import { NextResponse } from "next/server";
import { getDb } from "@/server/db/pg";
import { openLiveConnection } from "@/server/events/live-connections";
import { subscribeOperation } from "@/server/events/operation-events";
import { operationEventStream } from "@/server/events/sse";
import { resolveViewAccess } from "@/server/viewlinks/view-links";

const LIVE_CONNECTIONS_PER_VIEW_LINK = 50;

/** SSE-Strom für die read-only Ansichtslink-Ansicht; token- und status-gebunden wie der Zugang. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const access = await resolveViewAccess(getDb(), token);
  if (!access) return new NextResponse("Kein Zugang", { status: 403 });
  const release = openLiveConnection(
    `view:${token}`,
    LIVE_CONNECTIONS_PER_VIEW_LINK,
  );
  if (!release) {
    return new NextResponse("Zu viele Live-Verbindungen", { status: 429 });
  }
  return operationEventStream({
    subscribe: (notify) => subscribeOperation(access.operationId, notify),
    stillAllowed: async () =>
      (await resolveViewAccess(getDb(), token))?.operationId ===
      access.operationId,
    onClose: release,
  });
}
