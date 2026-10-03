---
criteria:  CRITERIA.md
closes:    AC-36
advances:
after:     04-kml-icons-einbetten, 07-links-entfernen-und-beim-abschliessen-loeschen, 13-sitzungs-token, 14-sitzungs-laufzeit
status:    done
attempts:  1
---

## Build
The Datenschutzerklärung says what the app now does: how long an Einsatz and
sessions are kept, that the server fetches KML addresses and icons, that
closing an Einsatz deletes its Gerätelinks and Ansichtslinks, and exactly the
services a browser contacts.

## Done when
> **AC-36** Die Datenschutzerklärung beschreibt, dass ein Einsatz mit ETB, Kartenobjekten und Uploads aufbewahrt wird, bis ein Admin ihn nach dem Abschließen löscht; die Laufzeit von Sitzungen (24 h ohne Nutzung, höchstens 30 Tage); den serverseitigen Abruf von KML-Adressen und -Icons; und dass beim Abschließen alle Geräte- und Ansichtslinks gelöscht werden. Sie nennt genau die Dienste, die ein Browser kontaktiert, und beschreibt serverseitige Abrufe (Photon, KML-Adressen und -Icons) als solche.

## Nudges

## Context
- **The page** is `src/app/datenschutz/page.tsx` (293 lines, static Mantine
  text, numbered sections 1-12), with `page.test.tsx` next to it (render +
  `screen.getByText`, German test names; new tests take English names).
- **What is wrong or missing today**, by section:
  - 5 (Nutzerkonto und Anmeldung): names the cookie „einsatz_session" and
    says it runs out "spätestens nach rund 30 Tagen". Ticket 13 renamed the
    cookie: in production it is `__Host-einsatz_session`, in development and
    tests it stays `einsatz_session` (`SESSION_COOKIE` in
    `src/server/auth/current-user.ts`). The page describes production, so it
    names `__Host-einsatz_session`. Ticket 14
    added the 24 h idle timeout and "Überall abmelden".
  - 6 (Einsatzdaten und ETB) and 10 (Datei-Uploads): say what is stored, not
    how long.
  - 7 (Standortdaten): Gerätelink and Ansichtslink are described, but not
    that a Gerätelink can be removed (ticket 07) and that "Abschließen"
    deletes all Gerätelinks and Ansichtslinks of the Einsatz (ticket 07).
  - 11 (Speicherdauer und Löschung): "Sitzungen … spätestens nach rund 30
    Tagen", and "personenbezogene Daten gelöscht, sobald der Zweck ihrer
    Verarbeitung entfällt" - the deletion the review found does not exist.
    What exists: an Einsatz with ETB, Kartenobjekte and Uploads stays until an
    admin deletes it after it has been closed (ticket 06; `deleteOperation`
    in `src/server/operations/delete-operation.ts` removes the rows by
    cascade and the upload files).
  - Server-side fetches: KML-URLs, their NetworkLinks and (ticket 04) icon
    addresses are fetched by the server (`src/server/kml/kml-fetch.ts`) at
    import and "Neu laden"; the browser no longer loads icons from other
    hosts. The page says nothing about this today. What reaches the remote
    host: the server's IP address and the requested address, not the
    browser's.
  - Section 8 (MapTiler) and 9 (Photon, server-side) stay true. In production
    the browser loads tiles only from `api.maptiler.com`; `tile.openstreetmap.org`
    is a development fallback only (ticket 05), so the page does not name
    OSM. The attribution links to maptiler.com / openstreetmap.org
    (`src/map/tiles.ts`) are links, not requests.
- **Which hosts a browser contacts** after tickets 04 and 05: the app itself
  and `api.maptiler.com` (the CSP's `img-src`/`connect-src` in `src/proxy.ts`
  allow nothing else in production). Confirm this in the browser rather than
  from the code (step 5).

## Plan
1. **Red: the AC's text pieces.** In `src/app/datenschutz/page.test.tsx`,
   new tests that render the page and find:
   - that an Einsatz with ETB, Kartenobjekten and Uploads is kept until an
     admin deletes it after closing it (match on the sentence's key parts:
     "Admin", "abgeschlossen", "gelöscht", and ETB/Kartenobjekte/Uploads);
   - the session runtime: "24 Stunden" without use and "30 Tage" at most;
   - the server-side fetch of KML addresses and icons (the heading or the
     sentence naming "KML" and "Icons" and "Server");
   - that closing deletes all Gerätelinks and Ansichtslinks;
   - the browser-contacted services: `api.maptiler.com` is named;
     `openstreetmap`, `tile.openstreetmap.org` and any other external host
     are not named as something the browser loads (`queryByText` → null);
   - the old promises are gone: no "sobald der Zweck ihrer Verarbeitung
     entfällt", no "rund 30 Tagen", no „einsatz_session" without the new
     prefix; "__Host-einsatz_session" is named.
   *Proof:* red - the current text has none of these pieces.
2. **Green: rewrite sections 5, 6, 7, 10, 11** and add a section for the
   server-side KML fetch (after 9, renumbering the rest):
   - 5: the cookie's production name „__Host-einsatz_session" instead of
     „einsatz_session", 24 h idle and at most 30 days, "Überall
     abmelden" ends the other sessions.
   - 6/10/11: Einsatz with ETB, Kartenobjekten and Uploads is kept until an
     admin deletes it after closing it; there are no automatic deletion
     periods; previous ETB versions are kept as long as the Einsatz.
   - 7: a Gerätelink can be removed; closing an Einsatz deletes all its
     Gerätelinks and Ansichtslinks, every old link then ends in "Zugang
     beendet".
   - New section: when a KML-Ebene is added by URL or reloaded, and for
     NetworkLinks and icons in a KML file, the server fetches those
     addresses; the remote host sees the server's IP address, not the
     user's; icons are stored embedded in the KML-Ebene, so viewers' browsers
     contact no other host.
   Keep the tone and the legal bases of the existing sections; keep the
   existing tests green.
   *Proof:* step 1 green; the old tests green.
3. **Check the rest of the page against the code**: sections 3, 4, 8, 9, 12
   still true (section 4: the login limit keeps IP addresses only in memory -
   still true after ticket 11, which normalises IPv6 to /64; say /64 only if
   it changes what is processed).
   *Proof:* nothing to change, or a change pinned by a test.
4. **Read it on the page** (skill `run-einsatz`), desktop and phone width:
   headings numbered without gaps, no text cut off.
   *Proof:* screenshots looked at, noted under `## Left standing`.
5. **What the browser contacts.** With a production build
   (`npm run build && npm start`, `MAPTILER_API_KEY` set from `.env`; if
   there is none, say so under `## Left standing` and check with the dev
   server, where OSM is the expected fallback) open, logged in, an Einsatz
   with a Kartenzeichen, a Bereich, a KML-Ebene added by URL with icons
   (e.g. a Google „Meine Karten" export), a Bild-Overlay, the Kartensuche,
   the QR code of an Ansichtslink, ETB and Stärke; then the Ansichtslink and
   a Gerätelink with location sharing. Record every request host the page
   makes (driver network log). Expected: only the app's own host and
   `api.maptiler.com`. Any other host is either named in the page or is a
   bug in an earlier ticket - say which.
   *Proof:* the host list under `## Left standing`.
6. `npm run check` green.

## Not here
- Changing what the app does: deletion by admin (06), link deletion on
  closing (07), session runtime (13, 14), icon embedding (04), CSP and tile
  source (05). This ticket only describes them; a behaviour that does not
  match is reported, not fixed here.
- The Impressum.
- From `CRITERIA.md`'s Out of scope:
  - "Automatische Löschfristen." - the page states that there are none; it
    does not promise any.
  - "Ablaufdatum für Links und eine Anzeige, wann ein Link zuletzt benutzt
    wurde." - links end when removed, deleted or when the Einsatz is closed;
    do not describe an expiry.
  - "Backups: das tägliche DB-Backup läuft in `../drk-barmbek`; ein Dump vor
    dem Deploy gehört dort dazu." - backups are not described here.

## Left standing
- **The "browser contacts only MapTiler" half of AC-36 is checked in the
  browser, not by a test.** The tests pin what the page says (the sentence
  that MapTiler is the only external service, the embedded icons, and that
  the only hosts the page names are `api.maptiler.com` and
  `photon.komoot.io`). Whether the app really keeps to that, the first
  reviewer checked on a production build (`npm run build` + `next start`,
  `MAPTILER_API_KEY` from `.env`) with the driver's network log and, for
  the Gerätelink with geolocation granted, a throwaway Playwright script.
  Screens: an Einsatz with two Kartenzeichen, a Kreis-Bereich, a KML-Ebene
  by URL (Google's `KML_Samples.kml`, with IconStyle icons and
  Ground/ScreenOverlays), a Bild-Overlay upload, the Kartensuche, the QR
  code of an Ansichtslink, an ETB entry and a Stelle in Stärke; then the
  Ansichtslink, and the Gerätelink at 390 px reporting its position.
  **Hosts seen: `localhost:3000` and `api.maptiler.com`, nothing else.** A
  real Google „Meine Karten" export with custom icons was not used (as in
  ticket 04, none was at hand).
- **Plan step 4:** both reviewers read `/datenschutz` at 390 px and 1440 px
  (production build, then dev server): headings 1–13 without gaps, then
  „Änderungen dieser Datenschutzerklärung"; no cut-off text, no horizontal
  overflow, no console errors.
- **Test that did not start red:** "names no external hosts but MapTiler and
  Photon" passed on the old page, which already named only those two. It
  guards against naming OSM or another host later.
- **Beyond the plan, each pinned by a test:**
  - Section 4 now says the IP address is also used, in memory only, when
    changing the password (ticket 11 limits both).
  - Section 10 covers uploaded KML/KMZ files too: the server fetches their
    NetworkLinks and icons as well, not only for KML-Ebenen added by URL
    (review finding).
  - Section 12 says user accounts stay until an admin deletes them, and that
    the user name stays as Urheber in ETB entries until the Einsatz is
    deleted (review finding: the Urheber is stored as text).
  - Section 7: the last reported position stays as the Kartenzeichen's
    position until it is moved or deleted, at the latest until the Einsatz
    is deleted; removing or deleting links does not delete it.
  - Sections 6 and 7 use the glossary's terms (Kartenzeichen, Bereiche,
    KML-Ebenen, Bild-Overlays) instead of „taktische Zeichen, Gebiete" and
    „Einsatzmittel".
  - Section 8 adds the sentence that MapTiler is the only external service
    the browser contacts; the new KML section is 10, so Uploads is 11,
    Speicherdauer 12 and Tracking 13.
- **Not reviewed again:** the second review's should-fix (a test for the
  "only MapTiler" and embedded-icons sentences) and its three nits were
  fixed after it; two review rounds is the limit, so no third reviewer read
  those last changes. `npm run check` is green after them.
