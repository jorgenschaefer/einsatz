import { loadReadOnlySituationMap } from "@/app/read-only-situation-map";
import { DeviceClosed } from "@/map/DeviceClosed";
import { ViewLinkView } from "@/map/ViewLinkView";
import { getDb } from "@/server/db/pg";
import { resolveViewAccess } from "@/server/viewlinks/view-links";

export default async function ViewPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const db = getDb();
  const access = await resolveViewAccess(db, token);
  if (!access) return <DeviceClosed />;
  const map = await loadReadOnlySituationMap(
    db,
    access.operationId,
    "/view",
    token,
  );
  if (!map) return <DeviceClosed />;
  return <ViewLinkView {...map} />;
}
