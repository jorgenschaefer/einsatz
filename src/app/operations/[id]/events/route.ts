import { NextResponse } from "next/server";
import { currentSessionToken, requireUser } from "@/server/auth/current-user";
import { findUserBySessionToken } from "@/server/auth/sessions";
import { getDb } from "@/server/db/pg";
import { openLiveConnection } from "@/server/events/live-connections";
import { subscribeOperation } from "@/server/events/operation-events";
import { operationEventStream } from "@/server/events/sse";
import { getOperation } from "@/server/operations/operations";

const LIVE_CONNECTIONS_PER_USER = 10;

/** SSE-Strom: signalisiert dem angemeldeten Client Änderungen an diesem Einsatz. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireUser();
  const token = await currentSessionToken();
  const { id } = await params;
  if (!(await getOperation(getDb(), id))) {
    return new NextResponse("Einsatz nicht gefunden", { status: 404 });
  }
  const release = openLiveConnection(
    `user:${user.id}`,
    LIVE_CONNECTIONS_PER_USER,
  );
  if (!release) {
    return new NextResponse("Zu viele Live-Verbindungen", { status: 429 });
  }
  return operationEventStream({
    subscribe: (notify) => subscribeOperation(id, notify),
    // Direkt über die Session, nicht getCurrentUser: der Strom zählt nicht als
    // Nutzung und hält die Sitzung nicht am Leben.
    stillAllowed: async () => {
      const db = getDb();
      const stillSignedIn = token
        ? (await findUserBySessionToken(db, token))?.id === user.id
        : false;
      return stillSignedIn && (await getOperation(db, id)) !== null;
    },
    onClose: release,
  });
}
