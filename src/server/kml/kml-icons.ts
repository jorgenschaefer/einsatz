import {
  bytesToDataUri,
  iconStyleHrefs,
  isImageMime,
  MAX_KML_BYTES,
  replaceIconStyleHrefs,
} from "@/kml/kmz";
import { type FetchBudget, readCapped, takeAddress } from "./fetch-budget";
import { assertFetchableKmlUrl, fetchFollowingRedirects } from "./kml-fetch";

const MAX_ICON_BYTES = 256 * 1024;

/**
 * Holt jedes http(s)-Symbol der `<IconStyle>`s einmal und bettet es als
 * `data:`-URL ein, damit der Browser nichts von fremden Hosts lädt. Ein Symbol,
 * das sich nicht laden lässt, kein Bild ist, größer als 256 KB ist oder nicht
 * mehr ins Budget passt, behält seine Adresse; die Lagekarte zeigt dafür den
 * Standard-Marker. Ebenso die Symbole, die die Ebene zusammen um mehr als
 * 20 MB vergrößern würden: Ein Symbol steht in jedem Stil, der es nennt.
 */
export async function embedKmlIcons(
  kml: string,
  budget: FetchBudget,
): Promise<string> {
  const dataUris = new Map<string, string>();
  for (const href of iconStyleHrefs(kml)) {
    const dataUri = await fetchIconDataUri(href, budget).catch(() => null);
    if (dataUri) dataUris.set(href, dataUri);
  }
  return replaceIconStyleHrefs(kml, dataUris, MAX_KML_BYTES);
}

async function fetchIconDataUri(
  href: string,
  budget: FetchBudget,
): Promise<string | null> {
  const target = assertFetchableKmlUrl(href);
  if (!takeAddress(budget)) return null;
  const response = await fetchFollowingRedirects(target);
  const mime = mimeType(response.headers.get("content-type"));
  if (!response.ok || !isImageMime(mime)) {
    await response.body?.cancel();
    return null;
  }
  return bytesToDataUri(
    await readCapped(response, budget, MAX_ICON_BYTES),
    mime,
  );
}

/** Der Medientyp eines `Content-Type` ohne Parameter, klein geschrieben. */
const mimeType = (contentType: string | null): string =>
  (contentType ?? "").split(";")[0].trim().toLowerCase();
