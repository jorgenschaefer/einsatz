"use client";

import { useRouter } from "next/navigation";
import type { ActionResult } from "@/app/action-result";
import {
  uploadImageOverlay,
  uploadKmlFile,
  uploadReplacementImage,
} from "./uploads";
import type { ViewExtent } from "./view";

/** Die Uploads der Lageansicht; sie laufen über Route Handler. */
export function useUploads(operationId: string) {
  const router = useRouter();
  // Anders als eine Server Action aktualisiert ein Route Handler die Seite des
  // Hochladenden nicht von selbst.
  const refreshingAfter = async (
    upload: Promise<ActionResult>,
  ): Promise<ActionResult> => {
    const result = await upload;
    if (!result.error) router.refresh();
    return result;
  };
  return {
    onAddKmlFile: (name: string, content: string) =>
      refreshingAfter(uploadKmlFile(operationId, name, content)),
    onAddImage: (file: File, view: ViewExtent) =>
      refreshingAfter(uploadImageOverlay(operationId, file, view)),
    onReplaceImage: (id: string, file: File) =>
      refreshingAfter(uploadReplacementImage(operationId, id, file)),
  };
}
