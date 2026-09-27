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
