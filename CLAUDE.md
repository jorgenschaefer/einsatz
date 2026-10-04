# Lageführung

Schlanke Lageführung für den Katastrophenschutz (Next.js App Router, React 19,
TypeScript, Mantine 9, Leaflet). Prinzip: Einfachheit vor Funktionsfülle.

## Prüfen / Testen

`npm run check` ist **das** Kommando, um Änderungen zu verifizieren. Es führt
nacheinander aus:

1. `tsc --noEmit` – Typprüfung
2. `npm run lint` – Biome (Linter + Formatprüfung)
3. `npm test` – Vitest (`vitest run`)

Nach jeder nennenswerten Änderung `npm run check` laufen lassen; erst wenn es
grün ist, gilt die Arbeit als fertig.

Weitere Kommandos:

- `npm run dev` – Dev-Server (Port 3000)
- `npm run build` / `npm start` – Produktions-Build/-Start
- `npm run format` – Biome-Formatter schreibend anwenden
- `npm run test:watch` – Vitest im Watch-Modus
- `npm run db:migrate` / `npm run db:seed` – DB migrieren / Erst-Admin anlegen

## Tests

- Vitest + Testing Library, Tests liegen neben dem Code (`*.test.ts(x)`).
- DB-Tests laufen gegen ein Wegwerf-Postgres im Container:
  `docker compose -f docker-compose.test.yml up -d` (Port 5437, Daten im RAM;
  abweichender Server per `TEST_DATABASE_URL`). `freshDb()` aus `src/test/db.ts`
  klont je Test eine eigene Datenbank aus einer migrierten Vorlage und löscht
  sie am Testende; die Dev-Datenbank wird **nicht** angefasst. Tests ohne DB
  brauchen den Container nicht.
- Vorgehen: TDD (red/green/refactor); jede Verhaltensänderung ist durch einen
  Test gepinnt, der zuerst fehlschlägt.
- Eine Testdatei je Quelldatei, nach ihr benannt und neben ihr
  (`Foo.tsx` → `Foo.test.tsx`); keine weiteren Testdateien wie
  `Foo.bar.test.tsx`. Ein Test testet die Datei, zu der er gehört, und liegt
  in deren Testdatei.
- Server-Action-Module (`"use server"`), Route-Handler (`route.ts`) und Seiten
  (`page.tsx`) unter `src/app/` rufen in ihrer Testdatei die gemeinsamen
  Prüfungen auf, die ihre Art verlangt: `src/test/action-checks.ts`,
  `src/test/route-checks.ts`, `src/test/page-checks.ts`.
- `npm run check` erzwingt beides (`src/test/test-files.test.ts`); jede
  Meldung nennt die Datei und die Abhilfe.

## Linting & Formatierung

- **Biome** (`biome.json`), Recommended-Regeln + Formatter. Einzige Abweichung
  vom Default: Einrückung mit **Leerzeichen** statt Tabs. ESLint wird nicht mehr
  verwendet.

## Konventionen

- Domänensprache Deutsch – siehe `UBIQUITOUS_LANGUAGE.md`; diese Begriffe in
  Code, Tests und Commits verwenden (Einsatz, Kartenzeichen, Einsatztagebuch/ETB,
  Bereich, Gerätelink …).
- DB-Zugriff läuft über den `Db`-Adapter (`src/server/db/db.ts`): zur Laufzeit
  `getDb()` (Postgres-Pool, `DATABASE_URL`), im Test `freshDb()` (eigene Datenbank je Test).
- Live-Aktualisierung über einen prozessweiten SSE-Event-Bus je Einsatz
  (`src/server/events/operation-events.ts`, an `globalThis` gepinnt).

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
