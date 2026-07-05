import { requireUser } from "@/server/auth/current-user";
import { subscribeOperation } from "@/server/events/operation-events";
import { operationEventStream } from "@/server/events/sse";

/** SSE-Strom: signalisiert dem angemeldeten Client Änderungen an diesem Einsatz. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireUser();
  const { id } = await params;
  return operationEventStream((notify) => subscribeOperation(id, notify));
}
