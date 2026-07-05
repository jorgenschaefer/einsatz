import { NextResponse } from "next/server";
import { getDb } from "@/server/db/pg";
import { subscribeOperation } from "@/server/events/operation-events";
import { operationEventStream } from "@/server/events/sse";
import { resolveDeviceAccess } from "@/server/mapsymbols/map-symbols";

/** SSE-Strom für die read-only Geräteansicht; token- und status-gebunden wie der Zugang. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const access = await resolveDeviceAccess(getDb(), token);
  if (!access) return new NextResponse("Kein Zugang", { status: 403 });
  return operationEventStream((notify) =>
    subscribeOperation(access.operationId, notify),
  );
}
