# Project 5 — Dev vs. prod environments

**Goal:** Two setups for the same app: `docker-compose.dev.yml` with hot reload (bind mount of my code) + pgAdmin, and `docker-compose.prod.yml` with the optimized image from project 4. Database migrations run automatically on startup.
**You learn:** bind mounts vs. volumes, compose overrides (merging several `-f` files), and environment-specific config.
**Done when:**
- [x] I edit code on my PC and the dev container reloads by itself (no rebuild)
- [ ] (extra) prod setup runs the small image, no bind mounts, no pgAdmin; migrations create the tables (no more `synchronize: true`)

> From project 4: one small multi-stage image (alpine, `USER node`, `HEALTHCHECK`, node = PID 1), compose waits for a healthy Postgres.
> Problem now: every code change = `up -d --build` (rebuild, ~30 s+). Fine for prod, painful for dev. And tables are created by `synchronize: true`, which is unsafe in prod (it can drop columns).
> Starting code = a copy of `04-prod-images/` (without `node_modules`/`dist`/`uploads`, `.env` copied over, still git-ignored). New folder = new compose project = new empty volume `05-dev-vs-prod_pgdata`.

Every step ends with 🔨 mini break-it(s): Claude quietly breaks one thing and gives only the symptom. Keep the files closed until you've looked with `ps` / `logs` / `inspect` / `config`.

---

## Step 0 — Warm-up (no notes) ✔ DONE
- 3 recall questions in chat: from project 4 + open `REVIEW.md` items. Update streaks.

## Step 1 — Bind mounts vs. volumes ✔ DONE
- Concept: a **named volume** (`pgdata`) = storage Docker manages, survives `down`, you don't edit it by hand. A **bind mount** (`./api/src:/app/src`) = a folder from MY PC shown inside the container, live, both directions. Whatever the image had at that path is hidden (not deleted) while the mount is there.
- 🤔 Predict: you bind-mount an EMPTY folder from your PC over `/app` in the api image. What does `ls /app` show inside, and does the app start?
- Commands: `docker run --rm -v "$PWD/tmp:/data" alpine sh -c 'echo hi > /data/x'` then `ls -l tmp` on the PC; `docker run --rm -v "$PWD/empty:/app" 05-dev-vs-prod-api ls /app`; `docker volume ls`, `docker inspect <c> --format '{{json .Mounts}}'`.
- ✅ Checkpoint: you can say which of the two you'd use for (a) Postgres data, (b) source code in dev, and WHY. Also: who owns the file the container wrote (uid)?
- 🔨 Mini break-it: ✔ container `mb1` with `api/src` bind-mounted over `/app/dist` → `Cannot find module`.

## Step 2 — A `dev` stage in the Dockerfile (written by me) ✔ DONE
- Concept: one Dockerfile, several stages: `build`, `dev` (all deps, `npm run start:dev` = `nest start --watch`), final prod stage. Compose picks a stage with `build: target: dev`. `docker build` without `--target` = the LAST stage.
- 🤔 Predict: the dev stage needs dev dependencies. Can it start `FROM build` instead of `FROM node:24-alpine`? What's the gain?
- Commands: write the `dev` stage yourself (re-practice from project 4's solo run), `docker build --target dev -t api-dev api`, `docker images`, `docker history api-dev`.
- ✅ Checkpoint: `api-dev` builds; you can explain why the dev image is big and why that's OK.
- 🔨 Mini break-it: ✔ `api-dev` tag moved onto the prod image → no `nest` in node_modules/.bin.

## Step 3 — Compose overrides: base + dev + prod ✔ DONE
- Concept: `docker-compose.yaml` = what's the SAME everywhere (postgres, healthchecks, env). `docker-compose.dev.yml` / `docker-compose.prod.yml` only add/change what differs. `docker compose -f base -f dev up` merges them (later file wins; lists like `ports` are ADDED, not replaced). `docker compose ... config` shows the merged result. (Also: `compose.override.yaml` is read automatically, and `COMPOSE_FILE` saves typing.)
- 🤔 Predict: base has `ports: ["3000:3000"]`, dev adds `ports: ["9229:9229"]`. How many ports does the merged api have?
- Commands: split the current compose file, `docker compose -f docker-compose.yaml -f docker-compose.dev.yml config`, same with prod, `diff` the two outputs.
- ✅ Checkpoint: `config` shows the dev api with `target: dev`, prod api with the final stage. Why keep a base file instead of two full copies?
- 🔨 Mini break-it: ✔ `DB_HOST: localhost` added in the dev override → api `Up` but `curl` fails, logs `ECONNREFUSED 127.0.0.1:5432`.

## Step 4 — Hot reload (Done when #1) ✔ DONE
- Concept: bind-mount `./api:/app`, run `start:dev`. Problem: the mount also hides the image's `/app/node_modules` (my PC has none, or the wrong OS build). Fix: an anonymous/named volume just for `/app/node_modules`, it "wins" over the bind mount at that path.
- 🤔 Predict: you change the text in `app.service.ts` and save. How long until `curl localhost:3000` shows it, and what do the api logs print?
- Commands: dev override with `volumes:` + `command:`/target, `docker compose -f ... -f ... up -d --build`, `docker compose logs -f api`, edit + save, `curl`.
- ✅ Checkpoint: edit → reload in seconds, no rebuild. Why: why does code change without a rebuild now, but a new npm package still needs one?
- 🔨 Mini break-it: ✔ `command: npm run start` in the dev override → no reload.
- 🔨 Mini break-it 2: ✔ bind mount made read-only (`./api:/app:ro`) → api exits, `EROFS`.

## Step 5 — pgAdmin (dev only) ✔ DONE
- Concept: a DB GUI in the browser, only in the dev file (in prod it's an extra door into the DB). It's just another container on the same network → which hostname does it use to reach Postgres?
- 🤔 Predict: in pgAdmin's "Add server" form, what do you type as Host: `localhost`, `127.0.0.1` or something else? Why?
- Commands: `dpage/pgadmin4` service in the dev override (`PGADMIN_DEFAULT_EMAIL`, `PGADMIN_DEFAULT_PASSWORD`, `5050:80`), open `localhost:5050`, connect, look at the `user` table. Extra: a pgadmin volume so the saved server survives `down`.
- ✅ Checkpoint: you see users in pgAdmin. Why: why isn't the host `localhost` here, but IS `localhost` in the browser URL?
- 🔨 Mini break-it: ✔ port mapping changed to `5050:8080` → connection reset, container `Up`.

## Step 6 — Migrations on startup
- Concept: `synchronize: true` changes tables to match the code, silently, every start (can drop a column = data loss). Migrations = versioned SQL files, run once, recorded in a `migrations` table. Claude writes the Nest/TypeORM part (data source + first migration); you wire it into compose: a one-shot `migrate` service + `api` `depends_on: migrate: condition: service_completed_successfully`.
- 🤔 Predict: you run the migration twice. What happens the second time, and how does TypeORM know?
- Commands: `docker compose ... run --rm migrate`, `docker compose ... ps -a` (`Exited (0)`), `psql ... -c 'SELECT * FROM migrations;'`, `down -v` + `up` on an empty DB.
- ✅ Checkpoint: empty DB → `up` → tables exist, api healthy. Why: why a separate one-shot service instead of running migrations inside every api container (think: 3 api replicas in project 6/10)?
- 🔨 Mini break-it: (Claude picks, symptom only)
- 🔨 Mini break-it 2: (Claude picks, symptom only)

## Step 7 — Prod run + environment config
- Concept: prod = final image, no bind mounts, no pgAdmin, no exposed Postgres port, `restart:`, `NODE_ENV=production`. Different values per environment via `env_file:` / `--env-file` (`.env.dev` vs `.env.prod`), never baked into the image.
- 🤔 Predict: you start prod while the dev stack is still up, same folder. What happens to the containers (same project name!)?
- Commands: `docker compose -f docker-compose.yaml -f docker-compose.prod.yml up -d --build`, `docker compose ps`, `docker inspect ... .Mounts`, `docker images`, `curl`.
- ✅ Checkpoint: Done when #2. Why: name 3 differences between dev and prod and the reason for each.
- 🔨 Mini break-it: (Claude picks, symptom only)

## Step 8 — Break it
- Claude breaks things from `ROADMAP.md`: the bind mount hides `node_modules`, a failing migration on startup, the wrong override file used. Only the symptom is given.
- Loop: symptom → look (`logs`, `ps -a`, `config`, `inspect .Mounts`) → guess → test → fix → explain. No hints for the first few minutes.
- ✅ Checkpoint: each one fixed and explained in your own words.

## Step 9 — Solo run
- From empty files: write the `dev` stage and `docker-compose.dev.yml` (bind mount + node_modules volume + start:dev), start dev, edit code, see the reload. Claude only watches. Lookups → `REVIEW.md`.
- ✅ Checkpoint: works without notes.

## Step 10 — Cleanup + cheat sheet
- `docker compose down`, `docker image prune`. `CHEATSHEET.md` as questions; I answer, Claude puts 💡 suggestions in the file.
- ✅ Checkpoint: "Done when" boxes ticked, Summary written.

---

## Notes / lessons learned
### Step 0
- Q1 (R29, correct): no `--target` → the LAST stage is the image; the other stages' `CMD`s are ignored (only the final stage's CMD counts).
- Q2 (R16, correct): `docker compose exec postgres psql -U app -d app`, then `SELECT * FROM "user";` (entity `User` → table `user`, not `users`; reserved word → quotes). One-liner: add `-c 'SELECT * FROM "user";'`.
- Q3 (R12, correct idea): code is baked into the image → `docker compose up -d --build`. Dev fix (this project): bind mount + `nest start --watch`.
### Step 1
- Didn't know bind mounts at first. Picture: a sheet of paper over a book page: the mount covers what the image had at that path (hidden, not deleted).
- Predicted correctly: empty folder over `/app` → `ls` empty, app fails `Cannot find module '/app/dist/main'`.
- Mistake: forgot `-v` → `invalid reference format: repository name (...) must be lowercase`: Docker took the path as the IMAGE name. → R9
- Empty folder shows `node node` inside: same uid 1000 as `tazo` on my PC. Linux only stores numbers; each side shows its own name for 1000.
- `touch /app/hello` inside → `hello` appears in `empty/` on my PC: bind mount works both ways.
- `exec` = shell in an ALREADY running container (app keeps running); `run --rm -it <image> sh` = NEW container, `sh` replaces CMD → for crashing/exiting containers. `-it` = keep input open + a terminal, else `sh` exits at once.
- Checkpoint (correct): DB files → volume (Docker manages it, survives `down`); code in dev → bind mount (edit on my PC, container sees it live).
- 🔨 Mini break-it: `mb1` (plain `docker run`, so NOT in `docker compose ps`; use `docker ps -a`). `logs` → `Cannot find module '/app/dist/main'` → `inspect --format '{{json .Mounts}}'` → my PC's `api/src` (only .ts) mounted over `/app/dist`, covering the image's `main.js`. Mounts can't be changed on an existing container → `rm` + `run` again without the mount. First idea "build on my PC and mount my dist" = fixing the symptom (R6 trap); the image's dist was fine.
### Step 2
- Predicted right: `FROM build` already has all node_modules → no second `npm ci`.
- First try: stage at the END of the file, no name, repeated WORKDIR/COPY/npm ci. Fixes: `FROM build AS dev` + only `CMD ["npm","run","start:dev"]`, placed BETWEEN build and prod, so prod stays the last stage = default image (knew Q1 in theory, didn't apply it → R29).
- Forgot to save the file before asking for a check (→ R10).
- `--target dev` builds build → dev and stops; no target builds build → prod and skips dev.
- api-dev = 619 MB disk / 159 MB content vs prod ~328/75. Big because of dev deps + source; OK because it only lives on my PC, never shipped.
- 🔨 Mini break-it: Claude ran `docker tag 05-dev-vs-prod-api api-dev`. `inspect` → `Cmd: node dist/main` (prod's CMD) → `docker images`: same ID for both names. A tag = a label pointing at an image ID; same mix-up happens with `docker build -t api-dev` WITHOUT `--target dev` (last stage = prod). Fix: `rmi api-dev` (only removes the label) + rebuild with `--target dev` → Cmd `start:dev`, `nest` in .bin.
### Step 3
- Predicted right: `ports` lists are ADDED on merge → api gets both 3000 and 9229.
- Split: base = postgres + api build/env/depends_on; dev adds `target: dev` + postgres `5432:5432` (DB GUI/psql from my PC); prod adds `target: prod` + `restart: unless-stopped`. Prod doesn't expose Postgres.
- Checkpoint (correct): one base file = change shared config once; with two full copies you forget to update one of them (layers instead of copies).
- 🔨 Mini break-it: api `Up`, `curl` no answer. First guess "wrong target" (no: Cmd was start:dev). Logs → `ECONNREFUSED 127.0.0.1:5432` = localhost = the api container itself. `inspect .Config.Env` → `DB_HOST=localhost`, found in `docker-compose.dev.yaml`. Maps (`environment:`) → later file overrides the same key; lists (`ports`) → added. Fix: remove it, `up -d` with both `-f`.
- Mistake: checked env with `docker compose run --rm api printenv` WITHOUT `-f` → only the base file → showed `DB_HOST=postgres` (not the broken container). Then started with plain `up -d --build` → prod image (`node dist/main`), not dev. → R33
- Side idea: `DB_HOST=localhost` in the shell only matters if the compose file says `${DB_HOST}`; a plain value can't be changed by `.env`/shell.
- Why break-its use tools before files: in real life you don't know which file changed; `inspect`/`config` show what the container actually got.
### Step 4
- Predicted right: no rebuild with `nest start --watch`; takes a few seconds (recompile + restart), same as on my PC. Bind mount = same files, nothing copied.
- Forgot the yaml for a bind mount: left side `./path` = bind, plain name = named volume, no `:` = anonymous volume. First try: `volumes:` at top level (no indent) = the named-volume declarations, not the api's; and missing `/app/node_modules`.
- Again started without `-f` → prod (`node dist/main`, no mounts) → R33.
- Works: `inspect` → Cmd `npm run start:dev`, mounts `bind:/app` + `volume:/app/node_modules`; logs `File change detected` → `Found 0 errors` → restart in ~1 s.
- `- /app/node_modules` = "exclude" it from the bind mount: a separate volume over that subpath, filled from the image's node_modules on first start.
- Checkpoint (correct): new npm package → code recompiles, but the container's node_modules is its own (image/volume), not my PC's → `Cannot find module` until rebuilt.
- 🔨 Mini break-it 1: Claude added `command: ["npm","run","start"]` to the dev override → edit + save, `curl` keeps the old text. Found via `config`/`inspect` Cmd. First guess "it comes from the Dockerfile build stage" (no: build has no CMD). Compose `command:` REPLACES the image's CMD, even with `target: dev`. `start` = `nest start` (compiles once, no `--watch`); `node dist/main` is `start:prod`. Fix: remove `command:`, `up -d` (no `--build`, image unchanged).
- 🔨 Mini break-it 2: Claude added `:ro` to the `./api:/app` bind mount → api `Exited (1)`, logs `EROFS: read-only file system, rmdir '/app/dist'` (EROFS = Error Read-Only FS; `nest start --watch` deletes + rewrites `dist/` on start). Needed a reminder of the inspect command (`docker inspect <c> --format '{{json .Mounts}}'`, look at `RW`) → R30 family. Found `Binds ...:/app:ro`. Fix: remove `:ro` in the dev override + `up -d` (recreate; mounts are fixed at create, `restart` isn't enough). Bind mounts come only from compose / `run -v`, never from the Dockerfile.
- Mistake: thought `:ro` was part of the path (`/app/ro`, empty folder). No: the 3rd part `host:container:mode` is an OPTION, `ro` = read-only. Files were there and readable; nest failed because it must WRITE `dist/`. → R34
### Step 5
- Predicted right: Host = `postgres` (service name = DNS name on the compose network; `localhost` in pgAdmin = the pgAdmin container).
- Wrote the `pgadmin` service + `pgadmindata` volume myself; top-level `volumes:` maps merge with base `pgdata`.
- `CERTIFICATE_VERIFY_FAILED` in pgAdmin logs = its update check blocked by the corporate proxy, harmless.
- Checkpoint (roughly right: "connects internally"): the DB connection is made by pgAdmin's server IN its container (→ `postgres`); the browser on my PC only talks to pgAdmin through the published port (→ `localhost:5050`).
- Mistake (again): `docker compose logs pgadmin` without `-f` → "no such service: pgadmin" (base file has no pgadmin). `ps` still listed it: ps shows the project's containers, not the file's services. → R33
- 🔨 Mini break-it: Claude changed pgAdmin's port to `5050:8080`. Browser: connection reset; `ps` Up + `5050->8080`. `inspect` Ports looked fine ("mapping exists" ≠ "works"); logs/the task → pgAdmin listens on 80. Explained (correct): Docker forwarded 5050 to container port 8080 where nothing listens → reset. Fix in the compose file (ready-made image, no Dockerfile), `up -d` with `-f`.
- Mistake: fixing the break, wrote `"80:5050"` (swapped). Ports = `HOST:CONTAINER` (left = my PC, right = where the app listens inside). → R35
### Step 6
- Predict (half right): 2nd run does nothing. But TypeORM doesn't look at the tables: it checks the `migrations` table (one row per migration NAME already run) and skips those. Re-running the SQL itself would fail (`relation "user" already exists`). → R36
- Claude wrote: `src/data-source.ts` (DB settings for the CLI, which runs outside Nest), `src/migrations/1793865600000-InitUsers.ts` (generated with `migration:generate` against an empty scratch DB), `synchronize: false` in app.module, npm scripts `migration:run` / `migration:show` (run from `dist/`, so they work in the prod image too). Tested on a scratch DB: run 1 → CREATE TABLE + row in `migrations`; run 2 → `No migrations are pending`.
- Side gotcha (Claude hit it): edited `package.json` with `sed -i` (replaces the file = new inode) → Docker Desktop's bind mount kept showing the OLD file (`Missing script`) until the container was restarted. Editors that save in place don't trigger this.
- Wired `migrate` myself (base file, same build + `secrets: [ca]` after a hint = R15 ✓, `command: ["npm","run","migration:run"]`, api `depends_on: migrate: service_completed_successfully`). Learned: an exited one-shot container stays as `Exited (0)` (logs readable, compose checks the code); removed by `down` or `run --rm`.
- First `up`: migrate `Exited (1)`, `relation "user" already exists` + `0 migrations are already loaded`. Guessed `autoLoadEntities` (no: that only registers entities; `synchronize: true` created the table since P03, so no migration was ever recorded).
- Fix: dev test data → `down -v` (R19: OK because I WANT it empty). Thought `docker volume prune` (no: only removes volumes no container uses, and only anonymous by default) → needed the command → R19. With real data: baseline = insert the migration's row into `migrations` by hand (after checking the schema matches + `pg_dump` backup).
- First `down` didn't remove the volume (no `-v` applied): `volume inspect` CreatedAt = yesterday + postgres log `Skipping initialization` → same old tables. After a real `down -v`: new volume, migrate `Exited (0)`, `migrations` has `InitUsers`, api `Up`, `/health` db up. Done when #2 (migrations part) ✓.
- Learned: before today no migrations existed; sync never lost data only because the entity never changed (rename a column → sync drops + re-adds = data gone). First migration = whole current schema, then one small migration per change (`migration:generate` writes it).
- ⏸ Paused 2026-11-05 here: next = Step 6 checkpoint why (separate migrate service vs. migrations in every api replica), then 2 mini break-its, then Step 7 (prod). Optional: switch to `COMPOSE_FILE` / `compose.override.yaml` to stop typing `-f`.
### Step 7
### Step 8
### Step 9
### Step 10

---

## Summary
(written at the end)
