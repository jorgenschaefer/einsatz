import { loadReadOnlySituationMap } from "@/app/read-only-situation-map";
import { DeviceClosed } from "@/map/DeviceClosed";
import { DeviceView } from "@/map/DeviceView";
import { getDb } from "@/server/db/pg";
import { resolveDeviceAccess } from "@/server/mapsymbols/map-symbols";

export default async function DevicePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const db = getDb();
  const access = await resolveDeviceAccess(db, token);
  if (!access) return <DeviceClosed />;
  const map = await loadReadOnlySituationMap(
    db,
    access.operationId,
    "/device",
    token,
  );
  if (!map) return <DeviceClosed />;
  return <DeviceView {...map} />;
}
