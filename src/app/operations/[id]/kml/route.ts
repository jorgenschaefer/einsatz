import { KML_TOO_LARGE } from "@/kml/kmz";
import { addKmlFile } from "@/server/kml/kml-import";
import { KML_LOAD_FAILED } from "../upload-messages";
import { formFileText, handleUpload } from "../upload-route";

/** Bindet eine KML-Datei ein (im Browser aus KMZ entpackt): `name`, `content`. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: operationId } = await params;
  return handleUpload(
    request,
    {
      tooLarge: KML_TOO_LARGE,
      failed: KML_LOAD_FAILED,
    },
    async (db, form) => {
      await addKmlFile(db, {
        operationId,
        name: form.get("name") ?? "",
        content: await formFileText(form, "content"),
      });
      return operationId;
    },
  );
}
