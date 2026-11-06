# Project 5 — Dev vs. prod environments

**Goal:** Two setups for the same app: `docker-compose.dev.yml` with hot reload (bind mount of my code) + pgAdmin, and `docker-compose.prod.yml` with the optimized image from project 4. Database migrations run automatically on startup.
**You learn:** bind mounts vs. volumes, compose overrides (merging several `-f` files), and environment-specific config.
**Done when:**
- [x] I edit code on my PC and the dev container reloads by itself (no rebuild)
- [x] (extra) prod setup runs the small image, no bind mounts, no pgAdmin; migrations create the tables (no more `synchronize: true`)

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

## Step 6 — Migrations on startup ✔ DONE
- Concept: `synchronize: true` changes tables to match the code, silently, every start (can drop a column = data loss). Migrations = versioned SQL files, run once, recorded in a `migrations` table. Claude writes the Nest/TypeORM part (data source + first migration); you wire it into compose: a one-shot `migrate` service + `api` `depends_on: migrate: condition: service_completed_successfully`.
- 🤔 Predict: you run the migration twice. What happens the second time, and how does TypeORM know?
- Commands: `docker compose ... run --rm migrate`, `docker compose ... ps -a` (`Exited (0)`), `psql ... -c 'SELECT * FROM migrations;'`, `down -v` + `up` on an empty DB.
- ✅ Checkpoint: empty DB → `up` → tables exist, api healthy. Why: why a separate one-shot service instead of running migrations inside every api container (think: 3 api replicas in project 6/10)?
- 🔨 Mini break-it: ✔ `user` table dropped by hand, `InitUsers` row still in `migrations` → `/health` db up, `/users` 500.
- 🔨 Mini break-it 2: ✔ `05-dev-vs-prod-migrate` tag moved onto project 4's image → `service "migrate" didn't complete successfully: exit 1`, api never starts.

## Step 7 — Prod run + environment config ✔ DONE
- Concept: prod = final image, no bind mounts, no pgAdmin, no exposed Postgres port, `restart:`, `NODE_ENV=production`. Different values per environment via `env_file:` / `--env-file` (`.env.dev` vs `.env.prod`), never baked into the image.
- 🤔 Predict: you start prod while the dev stack is still up, same folder. What happens to the containers (same project name!)?
- Commands: `docker compose -f docker-compose.yaml -f docker-compose.prod.yml up -d --build`, `docker compose ps`, `docker inspect ... .Mounts`, `docker images`, `curl`.
- ✅ Checkpoint: Done when #2. Why: name 3 differences between dev and prod and the reason for each.
- 🔨 Mini break-it: ✔ plain `docker run` container `cache-warmer` holding host port 3000 → prod `up`: `Bind for 0.0.0.0:3000 failed: port is already allocated`.

## Step 8 — Break it ✔ DONE
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
- Checkpoint (correct): 3 replicas = 3 migration runs at the same time → race (two of them see the migration as pending, both run CREATE TABLE, one crashes). One-shot service = migrate ONCE, then start the apps (`service_completed_successfully`); a failed migration also stops the api from starting on a half-changed schema.
- 🔨 Mini break-it 1: Claude ran `DROP TABLE "user"` (no file change). `/health` db up (only checks the connection), `/users` 500. Found it: no `user` table, but `migrations` still lists `InitUsers`. Predicted right: re-running migrate → `No migrations are pending` (TypeORM trusts the `migrations` table, not the real tables). Asked whether to delete "the migration" → the ROW in `migrations`, not the file. Deleted the row + ran migrate → table back (new row id 2), `/users` → `[]`. Why `/health` said db up (correct): it only checks the connection to Postgres, not the tables/migrations. Prod version of this: don't re-run migrations (they only build empty structure), restore from a backup.
- 🔨 Mini break-it 2: Claude ran `docker tag 04-prod-images-api 05-dev-vs-prod-migrate` + `down`/`up`. `logs migrate` → missing script `migration:run`. Tried `exec sh` (no service name + migrate already exited → R21) → `run --rm migrate cat package.json`: no migration scripts in the IMAGE (my `api/package.json` was fine). Guessed "build issue" (close: wrong image, not a broken build). api vs migrate having different IDs is normal (dev target vs last stage). Found: migrate's ID = `04-prod-images-api`, created 3 days ago. Fix: rebuild (`up -d --build`) → new migrate image, `Exited (0)`, api Up, `/users` → `[]`.
- Asked: `-p 05-dev-vs-prod` instead of the `-f`s? No: `-p` = project name only, still reads only the base file. To stop typing: `COMPOSE_FILE=docker-compose.yaml:docker-compose.dev.yaml` in `.env`.
- Added `COMPOSE_FILE=docker-compose.yaml:docker-compose.dev.yaml` to `.env` (Claude did it) → plain `docker compose ...` = dev; `config --services` now lists pgadmin. Gotcha: `.env` had no newline at the end, so the appended line got glued onto `DB_NAME=app` → fixed. Always end text files with a newline.
### Step 7
- Predict (half right): same project name → ONE set of containers, but the prod `up` replaces the running dev ones (not the other way around). api → `node dist/main`, Mounts `[]`; postgres recreated without the 5432 publish.
- pgAdmin kept running = **orphan** (in the project, but not in the current files); compose only warns `Found orphan containers`. Removed it with `--remove-orphans` (or `down` before switching). Then `docker ps` = api + postgres only, both healthy. Done when #2 ✓.
- Found: `NODE_ENV` isn't set anywhere yet (empty in the prod container). Added `NODE_ENV: production` under api `environment:` in the prod override (dev config doesn't get it).
- Thought env changes need a rebuild: no, env is set when the container is CREATED (not in the image) → `up -d` recreates it.
- Mistake: ran `up` WITHOUT `-f` → `COMPOSE_FILE` in `.env` = dev → dev came back (pgadmin, `start:dev`, bind mount), still no NODE_ENV. The container label `com.docker.compose.project.config_files` shows which files made it. Prod always needs both `-f` (they override `COMPOSE_FILE`). → R33
- 🔨 Mini break-it: found `cache-warmer` (plain `docker run`, so `compose down` can't remove it → `docker rm -f`). Explained (correct): inside, every container has its own network, so many can listen on 3000; the HOST port 3000 can belong to only one.
- Side effect: the api container created during the failed `up` had broken networking → `3000/tcp` (nothing published) + `EAI_AGAIN postgres` (not on the network). Yaml was fine; ports/networks are set at CREATE time → fixed by recreating (`up --build` made a new container). Lesson: after a failed `up`, compare `config` (should) with `ps`/`inspect` (got); recreate (`--force-recreate` or `down` + `up`).
- Prod check: api `node dist/main`, healthy, `NODE_ENV=production`, no mounts, postgres not published, no pgadmin.
- Checkpoint: (1) prod `node dist/main` vs dev `start:dev` watch: watch needs dev deps (big image) and rebuilds on file changes; prod has no source to watch ✓. (2) Postgres not published in prod: only reachable inside the compose network, nothing public ✓. (3) pgAdmin only in dev: said "in prod wouldn't be an issue" → it is: an extra login page with full DB access (default `admin/admin`) = a door attackers try. Good idea though: open it only when needed, only locally (SSH tunnel / compose `profiles`). → R37
### Step 8
- Note: a break command was visible in the terminal → scenario redone; Claude now says "🙈 don't look at the next tool call" before breaks (commands stay readable).
- Scenario 1 ✔ failing migration on startup: a "teammate's" migration `ALTER TABLE "user" ADD "age" integer NOT NULL` + an existing row (Ana) → migrate `Exited (1)` (`contains null values`) → api never starts. Found it myself: existing rows have no age → make it nullable or add a DEFAULT. Works on an empty DB = "works on my machine".
- Edit/delete a migration ONLY if it never ran anywhere (no row in `migrations`); once it ran somewhere → write a NEW migration.
- Real flow (did it once): change the entity (`@Column({ nullable: true }) age`) → `docker compose exec api npm run migration:generate -- src/migrations/AddUserAge` (in the dev container: it has node_modules, env, network; on my PC I'd need `npm ci` + build + `DB_HOST=localhost`) → READ the SQL (`integer`, no NOT NULL) → `up -d --build` (migrate runs from an IMAGE, so it needs a rebuild; the dev api sees the file via the bind mount) → `migrations` has `AddUserAge`, `/users` shows Ana with `age: null`.
- Entity changed but migration not run yet → `/users` 500 `errorMissingColumn` (synchronize is off, so nothing changes the DB by itself).
- Team flow: generate ONCE locally → commit entity + migration together → PR review of the SQL → CI/CD runs `migrate` on dev/staging, then prod (backup first). Nobody generates on prod.
- Claude changed `data-source.ts` to load `migrations/*.js` (glob), so new migrations don't need to be listed by hand; added the `migration:generate` npm script.
- `sh -c "..."`: `-c` belongs to `sh` = run this STRING as a shell command; only needed for shell features (`|`, `>`, `&&`, `$VAR`) inside the container. `exec api -c ...` without `sh` → R21.
- Scenario 2 ✔ wrong override file: Claude changed `COMPOSE_FILE` in `.env` to base + PROD → plain `up -d --build` = prod api (`node dist/main`, no mounts) → edit + save, `curl` shows old text. First guesses: "mount removed from the yaml" (no: dev yaml untouched), "overridden in the command" (no). With the hint → label `com.docker.compose.project.config_files` = base + prod → plain `docker compose` reads `COMPOSE_FILE` from `.env` → fixed it back to dev.
- After the fix the api was still not dev: label = only the base file, `node dist/main` (created before `.env` was saved / with `-f docker-compose.yaml`); `curl` looked right only because the rebuild baked the edit into the image. Plain `up -d` again → label base + dev, `start:dev`, mounts `bind:/app` + `volume:/app/node_modules`, edit reloads. → R33
- Scenario 3 ✔ bind mount + stale node_modules: "teammate" added `slugify` (package.json + lock + code) → `up -d --build` OK, but `curl` no answer; logs `TS2307: Cannot find module 'slugify'`. First guess "dev deps not installed" (no: dev stage = `FROM build`, full `npm ci`). Found: `run --rm 05-dev-vs-prod-api ls node_modules/slugify` → in the IMAGE ✓, `exec api ls ...` → not in the CONTAINER. Needed the explanation: the anonymous volume `- /app/node_modules` is filled from the image only once (when new/empty); compose REUSES it on every recreate → old node_modules sits over the new image's. Suggested `down -v` (works but deletes pgdata = R19 habit) → found `up -d -V` (`--renew-anon-volumes`) via `up --help`. Fixed: `hello-worldad1d!`, Ana still in the DB. Mixed up `-v` (down: delete ALL volumes) and `-V` (up: renew only anonymous ones). → R38
- Step 8 done ✔ (3 scenarios).
- ⏸ Paused 2026-11-06 ~18:00. Next: Step 9 Solo run → Step 10 cleanup + cheat sheet. Open recall Q for next warm-up: why does `docker compose ps` still list a container the current files don't mention (orphan)?
### Step 9
### Step 10

---

## Summary
(written at the end)
