import { addKmlFile } from "@/server/kml/kml-import";
import { KML_LOAD_FAILED } from "../upload-messages";
import { handleUpload } from "../upload-route";

/** Bindet eine KML-Datei ein (im Browser aus KMZ entpackt): `name`, `content`. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: operationId } = await params;
  return handleUpload(
    request,
    {
      tooLarge: "Die KML-Datei ist größer als 20 MB.",
      failed: KML_LOAD_FAILED,
    },
    async (db, form) => {
      await addKmlFile(db, {
        operationId,
        name: form.get("name") ?? "",
        content: await formText(form.get("content")),
      });
      return operationId;
    },
  );
}

const formText = async (value: FormDataEntryValue | null): Promise<string> =>
  typeof value === "string" ? value : (value?.text() ?? "");
