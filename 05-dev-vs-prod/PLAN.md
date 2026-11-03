# Project 5 — Dev vs. prod environments

**Goal:** Two setups for the same app: `docker-compose.dev.yml` with hot reload (bind mount of my code) + pgAdmin, and `docker-compose.prod.yml` with the optimized image from project 4. Database migrations run automatically on startup.
**You learn:** bind mounts vs. volumes, compose overrides (merging several `-f` files), and environment-specific config.
**Done when:**
- [ ] I edit code on my PC and the dev container reloads by itself (no rebuild)
- [ ] (extra) prod setup runs the small image, no bind mounts, no pgAdmin; migrations create the tables (no more `synchronize: true`)

> From project 4: one small multi-stage image (alpine, `USER node`, `HEALTHCHECK`, node = PID 1), compose waits for a healthy Postgres.
> Problem now: every code change = `up -d --build` (rebuild, ~30 s+). Fine for prod, painful for dev. And tables are created by `synchronize: true`, which is unsafe in prod (it can drop columns).
> Starting code = a copy of `04-prod-images/` (without `node_modules`/`dist`/`uploads`, `.env` copied over, still git-ignored). New folder = new compose project = new empty volume `05-dev-vs-prod_pgdata`.

Every step ends with 🔨 mini break-it(s): Claude quietly breaks one thing and gives only the symptom. Keep the files closed until you've looked with `ps` / `logs` / `inspect` / `config`.

---

## Step 0 — Warm-up (no notes)
- 3 recall questions in chat: from project 4 + open `REVIEW.md` items. Update streaks.

## Step 1 — Bind mounts vs. volumes
- Concept: a **named volume** (`pgdata`) = storage Docker manages, survives `down`, you don't edit it by hand. A **bind mount** (`./api/src:/app/src`) = a folder from MY PC shown inside the container, live, both directions. Whatever the image had at that path is hidden (not deleted) while the mount is there.
- 🤔 Predict: you bind-mount an EMPTY folder from your PC over `/app` in the api image. What does `ls /app` show inside, and does the app start?
- Commands: `docker run --rm -v "$PWD/tmp:/data" alpine sh -c 'echo hi > /data/x'` then `ls -l tmp` on the PC; `docker run --rm -v "$PWD/empty:/app" 05-dev-vs-prod-api ls /app`; `docker volume ls`, `docker inspect <c> --format '{{json .Mounts}}'`.
- ✅ Checkpoint: you can say which of the two you'd use for (a) Postgres data, (b) source code in dev, and WHY. Also: who owns the file the container wrote (uid)?
- 🔨 Mini break-it: (Claude picks, symptom only)

## Step 2 — A `dev` stage in the Dockerfile (written by me)
- Concept: one Dockerfile, several stages: `build`, `dev` (all deps, `npm run start:dev` = `nest start --watch`), final prod stage. Compose picks a stage with `build: target: dev`. `docker build` without `--target` = the LAST stage.
- 🤔 Predict: the dev stage needs dev dependencies. Can it start `FROM build` instead of `FROM node:24-alpine`? What's the gain?
- Commands: write the `dev` stage yourself (re-practice from project 4's solo run), `docker build --target dev -t api-dev api`, `docker images`, `docker history api-dev`.
- ✅ Checkpoint: `api-dev` builds; you can explain why the dev image is big and why that's OK.
- 🔨 Mini break-it: (Claude picks, symptom only)

## Step 3 — Compose overrides: base + dev + prod
- Concept: `docker-compose.yaml` = what's the SAME everywhere (postgres, healthchecks, env). `docker-compose.dev.yml` / `docker-compose.prod.yml` only add/change what differs. `docker compose -f base -f dev up` merges them (later file wins; lists like `ports` are ADDED, not replaced). `docker compose ... config` shows the merged result. (Also: `compose.override.yaml` is read automatically, and `COMPOSE_FILE` saves typing.)
- 🤔 Predict: base has `ports: ["3000:3000"]`, dev adds `ports: ["9229:9229"]`. How many ports does the merged api have?
- Commands: split the current compose file, `docker compose -f docker-compose.yaml -f docker-compose.dev.yml config`, same with prod, `diff` the two outputs.
- ✅ Checkpoint: `config` shows the dev api with `target: dev`, prod api with the final stage. Why keep a base file instead of two full copies?
- 🔨 Mini break-it: (Claude picks, symptom only)

## Step 4 — Hot reload (Done when #1)
- Concept: bind-mount `./api:/app`, run `start:dev`. Problem: the mount also hides the image's `/app/node_modules` (my PC has none, or the wrong OS build). Fix: an anonymous/named volume just for `/app/node_modules`, it "wins" over the bind mount at that path.
- 🤔 Predict: you change the text in `app.service.ts` and save. How long until `curl localhost:3000` shows it, and what do the api logs print?
- Commands: dev override with `volumes:` + `command:`/target, `docker compose -f ... -f ... up -d --build`, `docker compose logs -f api`, edit + save, `curl`.
- ✅ Checkpoint: edit → reload in seconds, no rebuild. Why: why does code change without a rebuild now, but a new npm package still needs one?
- 🔨 Mini break-it: (Claude picks, symptom only)
- 🔨 Mini break-it 2: (Claude picks, symptom only)

## Step 5 — pgAdmin (dev only)
- Concept: a DB GUI in the browser, only in the dev file (in prod it's an extra door into the DB). It's just another container on the same network → which hostname does it use to reach Postgres?
- 🤔 Predict: in pgAdmin's "Add server" form, what do you type as Host: `localhost`, `127.0.0.1` or something else? Why?
- Commands: `dpage/pgadmin4` service in the dev override (`PGADMIN_DEFAULT_EMAIL`, `PGADMIN_DEFAULT_PASSWORD`, `5050:80`), open `localhost:5050`, connect, look at the `user` table. Extra: a pgadmin volume so the saved server survives `down`.
- ✅ Checkpoint: you see users in pgAdmin. Why: why isn't the host `localhost` here, but IS `localhost` in the browser URL?
- 🔨 Mini break-it: (Claude picks, symptom only)

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
### Step 1
### Step 2
### Step 3
### Step 4
### Step 5
### Step 6
### Step 7
### Step 8
### Step 9
### Step 10

---

## Summary
(written at the end)
