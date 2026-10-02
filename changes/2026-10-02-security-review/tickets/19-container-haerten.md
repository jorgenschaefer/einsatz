---
criteria:  CRITERIA.md
closes:    AC-34, AC-37
advances:
after:     08-bild-overlay-dateien-absichern, 09-uploads-ueber-route-handler
status:    ready
attempts:  0
---

## Build
The production image runs the app as the unprivileged `node` user, and the
production compose file gives the container a memory and a process limit,
drops all capabilities, forbids privilege escalation, runs an init process
and rotates its logs.

## Done when
> **AC-34** Im Container läuft die App nicht als root.

> **AC-37** Der Produktions-Container hat eine Speicher- und eine Prozessgrenze; überschreitet die App die Speichergrenze, startet nur ihr Container neu; erreicht sie die Prozessgrenze, scheitert nur in ihrem Container das Starten weiterer Prozesse. In beiden Fällen laufen Host und andere Dienste weiter.

## Nudges
> `USER node` im `Dockerfile`, `data` in `.dockerignore`, `exec next start` statt `npm run start` in `docker-entrypoint.sh`; in `docker-compose.prod.yml` `init: true`, `cap_drop: [ALL]`, `security_opt: [no-new-privileges:true]`, `mem_limit`, `pids_limit` und Log-Rotation.

## Context
- **`Dockerfile`**: two stages on `node:${NODE_VERSION}-alpine` (24.21.0).
  The runner stage copies `.next`, `public`, `next.config.ts`, `src`,
  `tsconfig.json` and `docker-entrypoint.sh` from the builder as root,
  runs `mkdir -p /data/uploads`, and has no `USER`, so everything runs as
  root. The official node image already has a `node` user (uid 1000).
- **`docker-entrypoint.sh`**: `npm run db:migrate`, `npm run db:seed`, then
  `exec npm run start` - so npm, not Next, is the process that gets signals.
  Ticket 12 changes the seed step (no-op without env when users exist) and
  ticket 05 may add a startup check for `MAPTILER_API_KEY`; keep whatever they
  left and change only the start line. `next` is installed in the runner by
  `npm ci --omit=dev`, so `node_modules/.bin/next start` is available.
- **What the app writes at runtime**: uploads under `UPLOADS_DIR`
  (`/data/uploads`, a named volume `uploads` in production,
  `src/server/image-overlays/image-storage.ts`), and Next writes its cache
  under `.next/cache` (revalidation after every server action). Both must be
  writable by `node`.
- **The existing production volume** `uploads` was filled by a container
  running as root, so its files and directories belong to root. Docker copies
  the image's ownership only into an empty volume. After switching to
  `USER node` the app cannot write into the existing volume until it is
  chowned once.
- **`docker-compose.prod.yml`**: one service `app`, `restart: always`,
  external network `database_network`, volume `uploads`; no limits, no
  logging options. `bin/deploy-prod` builds, pushes, copies the compose file
  to the host and runs `docker compose … pull && … up -d --remove-orphans`.
- **`.dockerignore`** excludes `node_modules`, `.next`, `.git`, env files,
  docs; not `data`, so the local `data/uploads` (dev uploads) goes into the
  build context and, through `COPY . .`, into the builder stage.
- **The largest inputs the app accepts**, once the tickets this one comes
  after are built: a PNG of 100 megapixels (ticket 08 refuses more), a PDF
  of 20 MB whose first page is huge (ticket 08 renders it at most 4000 px on
  the longer edge, a canvas of at most 16 MP), and a KML/KMZ file of 20 MB
  (ticket 09's upload route reads at most 20 MB; tickets 04/21 cap a URL
  import at 20 MB in total). Measured outside the container on a dev
  machine while slicing (sharp and pdf-to-png-converter alone, no Next):
  resizing a 10,000 × 10,000 PNG as `prepareOverlayImage` does peaked at
  about 140 MB RSS; rendering a 4000 × 4000 px PDF page about 200 MB. Next's
  own baseline, the 20 MB request body, a 20 MB KML parse and concurrent
  uploads come on top and have not been measured; that is step 5. Node sizes
  its V8 heap from the cgroup memory limit, so a limit that is too small can
  also crash a legitimate KML import with "JavaScript heap out of memory".
- **The process limit does not restart anything.** When the container
  reaches `pids_limit`, `fork`/`clone` fails with `EAGAIN` inside it; the
  kernel kills nothing and Docker restarts nothing. What the limit gives is
  that a fork bomb in the container cannot exhaust the host's PIDs. AC-37's
  "überschreitet die App sie, startet nur ihr Container neu" therefore holds
  for memory only; for processes the plan proves that the host and other
  services keep running and the app's container stays confined. The
  mismatch with AC-37's wording is an open question for the user at
  approval; until it is answered, build to this reading.
- Docker 29.8 and Compose v5.5 are installed locally; `mem_limit`,
  `pids_limit`, `init`, `cap_drop`, `security_opt` and `logging` are
  service-level keys there.

## Plan
1. **Red: the app runs as root.** Build the image
   (`docker compose -f docker-compose.prod.yml build`) and run
   `docker run --rm --entrypoint id <image>` → `uid=0(root)`. Also start the
   app locally with a throwaway compose override outside the repo (scratch
   dir) that points `DATABASE_URL` at the dev Postgres and replaces the
   external network, and check `docker compose top` / `ps -o user` shows
   the Next server as root.
   *Proof:* the output, recorded under `## Left standing`.
2. **Green: `USER node`.** In the runner stage: copy the app files with
   `--chown=node:node` where Next writes (at least `.next`), create
   `/data/uploads` and `chown node:node` it, then `USER node` before
   `ENTRYPOINT`. Add `data` to `.dockerignore`.
   *Proof:* `docker run --rm --entrypoint id <image>` → `uid=1000(node)`;
   the running app (override from step 1) shows the server process as
   `node`; in the browser (skill `run-einsatz` against the container's port)
   log in, add a Kartenzeichen (server action + revalidation into
   `.next/cache`), upload a Bild-Overlay (write into `/data/uploads`) and see
   it on the map; `docker compose logs` shows no `EACCES`.
3. **Green: `exec next start`.** `docker-entrypoint.sh` ends with
   `exec node_modules/.bin/next start` (migrate and seed stay as they are).
   *Proof:* in the running container, PID 1 is `next-server` (or, with
   `init: true` from step 4, `next-server` is the direct child of the init
   process) - no `npm` process; `docker compose stop` ends within a second
   or two instead of the 10 s kill timeout.
4. **Green: limits and hardening in `docker-compose.prod.yml`.**
   `init: true`, `cap_drop: [ALL]`,
   `security_opt: ["no-new-privileges:true"]`, `mem_limit` (the value from
   step 5; start with `1g`), `pids_limit: 256`, `logging` with
   `driver: json-file` and `options: { max-size: "10m", max-file: "3" }`.
   *Proof:* `docker compose -f docker-compose.prod.yml config` shows all of
   them; the running container (override from step 1 merged over the prod
   file) reports them in `docker inspect` (`HostConfig.Memory`,
   `PidsLimit`, `CapDrop`, `SecurityOpt`, `Init`, `LogConfig`), and the app
   works as in step 2.
5. **Choose `mem_limit` by measuring the largest inputs.** Generate the
   inputs with a throwaway script in the scratch directory (not in the repo):
   - a 10,000 × 10,000 px PNG (flat colour, a few hundred KB; the largest
     ticket 08 accepts);
   - a 20 MB PDF whose first page is 200,000 × 100,000 pt, padded to 20 MB
     with drawing operators in its content stream (e.g. many small filled
     rectangles), so pdf.js parses and draws all of it; ticket 08's test
     helper `src/test/minimal-pdf.ts` is the starting point;
   - a 20 MB KML file of many `Placemark`s with `Point`s, names and
     descriptions.
   Run the container from the override (step 1) **without** `mem_limit`.
   For each input on its own, restart the container, log in, open the
   Lagekarte, upload the input in the browser (`run-einsatz`) or with
   `curl` against ticket 09's upload route, and read the cgroup's peak
   afterwards: `docker compose exec app cat /sys/fs/cgroup/memory.peak`.
   Then once more with all three uploaded at the same time.
   Choose `mem_limit` as the larger of `1g` and 1.5 × the highest peak
   (the concurrent run), rounded up to the next 256 MB.
   Then run all of it again **with** that limit: every upload succeeds,
   `RestartCount` stays 0, `OOMKilled` stays false, and `docker compose
   logs` shows no "heap out of memory".
   *Proof:* the peaks per input, the concurrent peak, the chosen value and
   the second run, recorded under `## Left standing`.
6. **AC-37 proof: exceeding the limits.**
   - Memory, without a legitimate upload: a second throwaway override (in
     the scratch directory) on the same image and the same `mem_limit`,
     `restart` and `init` as production, whose `entrypoint` is
     `["node", "-e", "const a = []; setInterval(() => a.push(Buffer.alloc(64 * 1024 * 1024, 1)), 50)"]`
     (Buffers are allocated outside the V8 heap, so the cgroup limit, not
     V8, stops it). `docker inspect` shows `State.OOMKilled: true` and a
     `RestartCount` that grows; meanwhile the dev Postgres container keeps
     its `StartedAt` and answers `psql -c 'select 1'`, and the host answers
     (`uptime`, `free -m`). Also, against the real app container:
     `docker compose exec app node -e` with the same allocation; record
     which process the kernel killed (`dmesg` or `docker inspect`) and that
     host and Postgres are unaffected either way.
   - Processes: `docker compose exec app node -e` that spawns `sleep 60`
     children in a loop until `spawn` fails, printing the error code
     (`EAGAIN`) and the count (near 256). While it is at the limit:
     `docker stats --no-stream` shows the container's PIDS at 256; the host
     can still start processes (`bash -c 'for i in $(seq 50); do sleep 1 &
     done; wait'`) and the dev Postgres answers `psql -c 'select 1'`. After
     the spawner ends (its children with it), the app answers `/login`
     again. No restart is expected here; record that under `## Left
     standing` as the difference from AC-37's wording.
   *Proof:* the outputs, recorded under `## Left standing`.
7. **Migrating the existing `uploads` volume.** Make the deploy chown the
   volume once before the new container starts: in `bin/deploy-prod`, before
   `up -d`, run a one-off container as root on the same volume that runs
   `chown -R node:node /data/uploads` (it is idempotent, so it may run on
   every deploy). Check how `docker compose run` treats `cap_drop: [ALL]` -
   `chown` needs `CAP_CHOWN` (`--cap-add CHOWN`, or a plain `docker run`
   with the volume's full name).
   *Proof:* locally, fill a volume with a root-owned file using the old
   image, deploy the new image with the chown step, and upload a Bild-Overlay
   and replace the old one successfully.
8. **README** (`## Deployment`): one sentence that the container runs as
   `node` and the uploads volume must belong to uid 1000.
   *Proof:* read it.
9. `npm run check` green (no TypeScript changes; it guards the rest).

Decided here (show at approval): `mem_limit` at least `1g`, otherwise
1.5 × the measured peak of step 5 rounded up to 256 MB; `pids_limit: 256`;
log rotation at 3 × 10 MB; chowning the existing volume from
`bin/deploy-prod` on every deploy rather than as a manual one-off step.

## Not here
- Seed without `ADMIN_USERNAME`/`ADMIN_PASSWORD` and the `.env.example`
  change: ticket `12-passwoerter-und-erst-admin`.
- The startup check for `MAPTILER_API_KEY`: ticket `05-sicherheits-header`.
- From `CRITERIA.md`'s Out of scope:
  - "Alles in `../drk-barmbek`: Header und Body-Grenzen im Caddy, Backup des
    `uploads`-Volumes, Backup auf einen anderen Rechner, das committete
    `database/.env`. Das wird eine eigene Änderung dort."
  - "Client-IP hinter Caddy ist korrekt; dass andere Container am
    `database_network` Port 3000 direkt erreichen, gehört zu
    `../drk-barmbek`." - do not change the network setup here.
  - "Backups: das tägliche DB-Backup läuft in `../drk-barmbek`; ein Dump vor
    dem Deploy gehört dort dazu." - `bin/deploy-prod` gains only the chown
    step, no dump.

## Left standing
