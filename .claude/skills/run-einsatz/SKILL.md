---
name: run-einsatz
description: Run, start, drive and screenshot the einsatz Lageführung web app (Next.js). Use when asked to launch einsatz, log in, open an Einsatz, look at the Lagekarte or ETB, check a UI change in the real browser (desktop or mobile viewport), or run its tests.
---

Start (or reuse) the Next dev server on :3000, then drive it with the
headless-Chromium REPL `.claude/skills/run-einsatz/driver.mjs` (Playwright).
All paths are relative to `einsatz/`.

## Setup (once)

```bash
docker compose up -d db              # dev Postgres on 127.0.0.1:5436
npm install
npm run db:migrate                   # "Migrationen angewandt."
npm run db:seed                      # "Admin-Konto sichergestellt." (ADMIN_* from .env)
npm install --prefix .claude/skills/run-einsatz   # playwright-core 1.63.0 for the driver
```

`.env` (copy from `.env.example`) must hold `DATABASE_URL`, `ADMIN_USERNAME`,
`ADMIN_PASSWORD`. The driver's `login` uses those credentials.
playwright-core 1.63.0 expects Chromium revision 1243 in `~/.cache/ms-playwright`,
which is already installed on this machine.

## Dev server

Only **one** `next dev` can run per checkout (see Gotchas), so first check
whether the user already has one running:

```bash
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3000/login   # 200 → reuse it
```

If nothing is listening, start it in the background: `npm run dev`, then poll
`/login` until you get a 200. To stop it, `lsof -ti:3000 -sTCP:LISTEN | xargs -r kill`
(only kill a server you started yourself).

## Run (agent path): the driver

It reads one command per line from stdin and prints `ok <cmd> → result` or
`ERR <cmd>: …`. Write the script to a file and redirect it in. Screenshots
go to `/tmp/einsatz-shots/NN-<name>.png` (`SHOTS_DIR` overrides this; `BASE_URL`
defaults to `http://localhost:3000`). Always open the PNGs and check them.

This verified flow creates an Einsatz, checks the Lagekarte and the ETB
(desktop and mobile), then deletes it again. It writes to the dev DB, so
clean up after yourself:

```bash
cat > "${TMPDIR:-/tmp}/einsatz-cmds.txt" <<'EOF'
login
click role=button[name="Neuer Einsatz"]
fill label=Bezeichnung Smoke-Test
click role=button[name="Einsatz eröffnen"]
wait-url **/operations/*
wait-tiles
ss lagekarte
click text=ETB
fill 'label=Neuer Eintrag' Lage erkundet
press Control+Enter
wait-for text=#2
wait-fn document.querySelector('textarea[aria-label="Neuer Eintrag"]').value === ''
ss etb
viewport 390x844
ss etb-mobile
errors
viewport 1280x800
nav /operations
click '.mantine-Card-root:has-text("Smoke-Test") [aria-label="Einsatz-Aktionen"]'
click role=menuitem[name="Einsatz löschen"]
click role=button[name="Endgültig löschen"]
wait-fn !document.body.innerText.includes('Smoke-Test')
quit
EOF
timeout 300 node --env-file=.env .claude/skills/run-einsatz/driver.mjs < "${TMPDIR:-/tmp}/einsatz-cmds.txt"
```

| command | what it does |
|---|---|
| `login` | logs in as `ADMIN_USERNAME`/`ADMIN_PASSWORD` and waits for `/operations` |
| `nav <path>` | goes to the path, relative to `BASE_URL` |
| `click <sel>` / `wait-for <sel>` | acts on or waits for the first match (30 s timeout) |
| `fill <sel> <text>` | fills an input. Quote the selector as `'…'` if it contains spaces |
| `press <key>` | presses a key, e.g. `press Control+Enter` (submits the ETB draft) |
| `wait-url <glob>` | waits for navigation |
| `wait-fn <js>` | waits until the JS expression is truthy |
| `wait-tiles` | waits until every Leaflet tile has loaded |
| `ss [name]` | takes a full-viewport screenshot |
| `viewport WxH` | resizes the viewport, e.g. `390x844` for phone layout, then waits for the AppShell animation |
| `text [sel]` / `eval <js>` / `url` | inspects the page |
| `errors` | prints and clears browser console errors and page errors |
| `quit` | closes the browser |

Selectors: anything `page.locator()` accepts (`text=…`, `role=button[name="…"]`,
CSS with `:has-text()`), plus `label=<label substring>` for Mantine form fields.
For iterative poking, run the driver under tmux and `send-keys` one command at a time.

## Test

```bash
docker compose -f docker-compose.test.yml up -d   # throwaway Postgres on :5437
npm run check                                      # tsc + biome + vitest (~2.5 min)
```

## Gotchas

- **A second `next dev` refuses to start.** It prints `Ready`, then
  `⨯ Another next dev server is already running … PID … Run kill <pid>`, even
  on another port (`-p 3100`). The lock lives in `.next/dev/`. If the user's
  server is up, reuse it rather than killing it.
- **`text=` also matches the ETB draft textarea.** `wait-for text=Lage erkundet`
  succeeds as soon as you've typed it, before anything is saved. Wait for the
  entry number instead (`wait-for text=#2`).
- **The ETB draft clears after the entry appears.** The entry arrives over
  SSE before the server action returns, and the textarea empties only when
  the action returns. Wait for `value === ''` before screenshotting.
- **An unquoted `fill label=Neuer Eintrag Lage erkundet` goes wrong silently.**
  The selector becomes `label=Neuer` and the text becomes "Eintrag Lage erkundet".
  Quote selectors that contain spaces.
- **Map tiles load after `domcontentloaded`,** and the SSE stream means
  `networkidle` never settles. Use `wait-tiles`, otherwise the map is grey
  or only partly drawn.
- **Clicks right after page load hit un-hydrated HTML and do nothing.**
  The Mantine menu never opened after `nav /operations` while `nav` waited
  only for `domcontentloaded`. `nav` now waits for `load`. If a click
  "succeeds" but nothing happens, wait for something client-rendered first.
- **Each card on `/operations` has its own `Einsatz-Aktionen` button.** Scope
  it with `.mantine-Card-root:has-text("<name>")`. `text=Einsatz löschen`
  didn't reliably hit the menu item, but `role=menuitem[name=…]` does.
- **Screenshots right after a resize catch the navbar mid-animation,** leaving
  an empty strip on the left in phone layout. `viewport` now waits 500 ms for this.
- The Next dev-indicator bubble ("N", bottom left) overlaps the mobile footer
  nav in screenshots. That's dev-only.

## Troubleshooting

- **The driver exits with no output after an `ERR … Timeout 30000ms`**: the
  outer `timeout` killed it, because each failed step burns 30 s. Fix the
  selector, or raise the outer `timeout`.
- **`ERR login: locator.fill: Timeout`**: the password field's label is
  "Passwort *" plus a visibility toggle, so it doesn't match a label lookup.
  The driver fills `input[name=password]` instead. If login still fails,
  check `.env` and run `npm run db:seed`.
