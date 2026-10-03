import type { ActionResult } from "@/app/action-result";
import { POST } from "@/app/operations/[id]/kml/route";
import { multipartRequest, routeParams } from "./upload-request";

/** Lädt eine KML-Datei über die Upload-Route hoch, wie der Browser es tut. */
export async function postKmlFile(
  operationId: string,
  name: string,
  content: string,
): Promise<ActionResult> {
  const response = await POST(
    await multipartRequest("POST", kmlFileForm(name, content)),
    routeParams({ id: operationId }),
  );
  return response.json();
}

export function kmlFileForm(name: string, content: string): FormData {
  const form = new FormData();
  form.append("name", name);
  form.append("content", new Blob([content]), "karte.kml");
  return form;
}
