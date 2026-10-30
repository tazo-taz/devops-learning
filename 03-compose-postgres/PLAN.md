# Project 3 — NestJS + Postgres with Docker Compose

**Goal:** Build a modular NestJS app (a `users` module with TypeORM) and run it together with Postgres using `docker-compose.yml`.
**You learn:** Compose, container networking (the app connects to the hostname `postgres`, not `localhost`), `.env` files, and volumes so data survives restarts.
**Done when:**
- [x] `docker compose up` starts everything
- [x] your users are still there after `docker compose down` and `up` again

> From project 2: I can write a Dockerfile and run ONE container with `docker run -p ... -e ...`.
> Now: several containers that must talk to each other. Instead of long `docker run` commands, we describe the whole setup in one file.
> Starting code = a copy of `02-dockerize-nestjs/api` (without `node_modules`/`dist`).

---

## Step 1 — First `docker-compose.yml`: only Postgres + a named volume ✔ DONE
- Concept: Compose = a YAML file that lists your **services** (containers), their ports, env vars and volumes. `docker compose up` = all the `docker run` commands at once. A **named volume** = disk space managed by Docker that lives outside the container.
- File: `docker-compose.yml` (in `03-compose-postgres/`) with one service `postgres` (`image: postgres:16`, `POSTGRES_USER/PASSWORD/DB`, `ports: 5432:5432`, `volumes: pgdata:/var/lib/postgresql/data`).
- Commands: `docker compose up -d`, `docker compose ps`, `docker compose logs postgres`, `docker compose exec postgres psql -U app -d app`, `docker volume ls`
- ✅ Checkpoint: inside `psql`, `\l` lists your database. You can say what a service and a named volume are.

## Step 2 — Add the `api` service (build from the Dockerfile) ✔ DONE
- Concept: a service can use `build:` (your Dockerfile) instead of `image:`. The office CA secret now goes in the compose file (`build.secrets` + top-level `secrets:`), because the `docker()` bash function doesn't cover `docker compose build`.
- Commands: `docker compose up -d --build`, `docker compose ps`, `curl localhost:3000/health`
- ✅ Checkpoint: both services run, `/health` answers. The image builds through the proxy.

## Step 3 — Container networking: who is `localhost`? ✔ DONE
- Concept: Compose creates a network for the project. Every service can reach the others **by service name** (built-in DNS). Inside the api container, `localhost` = the api container itself, NOT your PC and NOT Postgres.
- Experiments: `docker network ls`, `docker compose exec api getent hosts postgres`, try reaching the DB at `localhost:5432` vs `postgres:5432` from inside api.
- ✅ Checkpoint: you can explain why the app must use host `postgres`, and why `ports:` on Postgres is only needed for tools on your PC.

## Step 4 — Connect NestJS to Postgres with TypeORM ✔ DONE
- Concept: an ORM maps TypeScript classes (entities) to tables. NestJS config comes from env vars (`DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`), never hardcoded.
- Commands: `npm install @nestjs/typeorm typeorm pg` (on your PC, updates `package*.json`), `TypeOrmModule.forRoot(...)` in `app.module.ts`, env vars in the `api` service.
- `TypeOrmModule.forRoot({...})` with `process.env.DB_*` + `autoLoadEntities: true`.
- `synchronize: true` creates tables automatically. OK for learning; real migrations come in project 5.
- ✅ Checkpoint: `docker compose logs api` shows a successful DB connection, no `ECONNREFUSED`.

## Step 5 — `.env` file: config out of the YAML ✔ DONE
- Concept: secrets and settings belong in `.env` (not committed). Compose reads `.env` automatically for `${VAR}` substitution; `env_file:` passes variables into a container. Commit a `.env.example` with fake values.
- Commands: `docker compose config` (shows the final YAML with variables filled in), add `.env` to `.gitignore`.
- ✅ Checkpoint: no password in `docker-compose.yml`, `git status` doesn't show `.env`, everything still works.

## Step 6 — The `users` module (entity, service, controller) ✔ DONE
- Concept: Nest module = one feature in a folder (module + controller + service + entity). Controller = HTTP, service = logic, repository = DB access.
- Commands: `npx nest g resource users` (or module/controller/service), `User` entity (`id`, `name`, `email`), `POST /users`, `GET /users`.
- Test: `curl -X POST localhost:3000/users -H 'Content-Type: application/json' -d '{"name":"Tazo","email":"t@example.com"}'`, then `curl localhost:3000/users`, and look at the table in `psql`.
- ✅ Checkpoint: a created user shows up in `GET /users` AND in `SELECT * FROM "user";`.

## Step 7 — Persistence test: `down`, `up`, `down -v` ✔ DONE
- Concept: `docker compose down` removes containers + network, but **keeps named volumes**. `down -v` deletes the volumes too, so the data is gone.
- Commands: `docker compose down` → `docker compose up -d` → `curl localhost:3000/users` (still there?), then try `down -v` and see the difference.
- ✅ Checkpoint: users survive `down`/`up`. (Done criteria #1 and #2.) You know when `-v` destroys data.

## Step 8 — Startup order + everyday Compose commands ✔ DONE
- Concept: `depends_on` starts Postgres first but does NOT wait until it's *ready*. Watch the api fail or retry on a cold start. `restart: unless-stopped`. (Proper waiting with healthchecks = project 4.)
- Commands: `docker compose restart api`, `docker compose logs -f`, `docker compose stop` vs `down`, `docker compose exec`, `docker compose up -d --build api`.
- ✅ Checkpoint: you can explain `stop` vs `down` vs `down -v`, and why `depends_on` alone isn't enough.

## Step 9 — Cleanup + cheat sheet ✔ DONE
- `docker compose down`. Claude generates `CHEATSHEET.md` as questions (compose structure, networking, volumes, `.env`, commands); I answer them in the file, Claude puts suggestions in the file.
- ✅ Checkpoint: "Done when" boxes above are ticked.

---

## Notes / lessons learned
### Step 1
- `docker-compose.yaml` (`.yml` works too). Volume syntax = `volume-name:path-in-container`. Postgres data path = `/var/lib/postgresql/data` (`PGDATA` in the image docs / `docker image inspect`). Wrong path = no error, data silently lost.
- `docker compose config` = validate the file + show the final version (Compose adds a `default` network itself).
- Compose prefixes everything with the **project name** (= folder name): volume `03-compose-postgres_pgdata`, network `03-compose-postgres_default`, container `03-compose-postgres-postgres-1` (project-service-number). Two projects can each have a `pgdata` without clashing.
- The other volume with a long hash = **anonymous volume** from project 1 (`docker run postgres` without `-v`: the image declares `VOLUME`, so Docker made one with no name).
- Logs "database system was shut down" right before "ready" = normal on first start: the entrypoint creates the DB, restarts Postgres, then it's ready.
### Step 2
- `build: context: api` = the FOLDER (like the `.` in `docker build .`), not `api/Dockerfile`. Compose finds `Dockerfile` in it.
- Build secret: `build.secrets: [ca]` uses it, top-level `secrets: ca: file: ...MIA-ROOT-CA.crt` defines it. Name must match `id=ca` in the Dockerfile. A secret is a FILE for the build, not an env var/port.
- Mistake: `docker compose up -d build` → "no such service: build". Without `--` a word = service name. `--build` = flag.
- `up -d` builds only if the image doesn't exist yet; if it exists it reuses the OLD image even after code changes. Changed code → `up -d --build`.
- Compose v5 builds via **Bake**, which blocks reading files outside the project folder: "additional privileges requested: --allow=fs.read=...". Protects against a foreign compose file stealing e.g. `~/.ssh`. Fix: `export BUILDX_BAKE_ENTITLEMENTS_FS=0` in `~/.bashrc` (only build compose files I trust).
- `npm ci` was `CACHED`: build cache is keyed on instruction + input files, not image name → same Dockerfile + package*.json as project 2 = reused.
- Image name = `03-compose-postgres-api` (project-service). `/health` answers from the compose-started container.
### Step 3
- Compose network `03-compose-postgres_default` + built-in DNS: `getent hosts postgres` → 172.18.0.3 = the postgres container. Use names, not IPs (IPs change when containers are recreated).
- `localhost` = the machine/container I'm inside right now. In api, `localhost:5432` → Connection refused (nothing listens there); `postgres:5432` → open.
- Container→container uses the CONTAINER port directly. `ports:` is only the door from my PC (psql, DBeaver, curl). Proof: commented out postgres `ports:` → api→postgres still open, PC→5432 refused.
- Word: `ports:`/`-p` = **publish**. `EXPOSE` = only documentation (project 2).
- So in NestJS: `DB_HOST=postgres`, `DB_PORT=5432`. Reverse direction (container → my PC) = `host.docker.internal`.
- Mistake: edited the yaml but didn't save → experiment showed the old result. Check the file / `docker compose ps` PORTS column.
### Step 4
- `npm install @nestjs/typeorm typeorm pg` worked with NestJS 12 (no peer-dep crash). `typeorm` = ORM, `@nestjs/typeorm` = Nest glue, `pg` = Postgres driver.
- `TypeOrmModule.forRoot({...})` reads `process.env.DB_*` → same image works anywhere, only env changes. `synchronize: true` = learning only.
- Mistake: wrote `DB_DB` in the YAML, code reads `DB_NAME` → `database: undefined`. Still connected because `pg` falls back to "database = username" (`app`). Works by luck ≠ correct. Env var names in YAML must match the code exactly.
- Debug habit: `docker compose exec api printenv | grep DB_` = what the container REALLY got.
- Env/ports change → `docker compose up -d` recreates the container, no `--build` needed. Code change → `--build`.
- `package*.json` changed → `npm ci` really ran → proxy secret through compose works.
### Step 5
- `.env` next to the compose file is read automatically → `${DB_PASSWORD}` in YAML. One place for the value, used by both postgres (`POSTGRES_*`) and api (`DB_*`). `DB_HOST`/`DB_PORT` stay in YAML (wiring, not secrets).
- `.env` is ignored by the workspace-root `.gitignore` (applies to all subfolders; `git check-ignore -v .env` shows the rule). Commit `.env.example` with fake values.
- Experiment: `DB_PASSWORD=app2` → api `Exited (1)`, "password authentication failed". `POSTGRES_PASSWORD` is used ONLY on first init (empty data folder); the `pgdata` volume keeps the old password. Fix: `ALTER USER app PASSWORD '...'` or `down -v` (deletes data).
- Confusion: old "auth failed" lines in `docker compose logs postgres` were 45 min old. Logs keep the container's whole history; a recreated container starts with empty logs. Use `logs -t` (timestamps), `--since 5m`, `-f`.
- `.env` files had CRLF again → switched to LF. Compose strips `\r`, many tools don't.
### Step 6
- Nest code written by Claude (I focus on the DevOps side): `src/users/` = entity (table shape), dto (request body), service (repository `save`/`find`), controller (`POST`/`GET /users`), module (`TypeOrmModule.forFeature([User])`).
- `synchronize: true` created the `user` table automatically (`\dt`).
- psql: SQL needs `;` at the end. Prompt `app=#` = ready, `app-#` = still collecting the query. `\` commands (`\dt`, `\l`, `\q`) run without `;`. Ctrl+C clears the buffer.
- `user` is a reserved word → `SELECT * FROM "user";` (without quotes = my login name).
- Same email twice → DB `unique` constraint rejects it (data stays correct), but API said 500 (= server bug). Fixed: catch Postgres error `23505` → 409 Conflict (client's mistake).
- Logs show the real cause: `QueryFailedError: duplicate key value violates unique constraint`. 500 → read the api logs.
### Step 7
- `down` → containers + network gone, `pgdata` volume kept → `up` → users still there. (Done criteria #1 and #2.)
- `down -v` → volume deleted → `up` → `[]`. No crash: on startup `synchronize: true` creates the `user` table again from the entity (`forFeature([User])` + `autoLoadEntities`). Without synchronize (production), the table would be missing → migrations in project 5.
- After `-v` the data folder is empty → Postgres runs its first-time init again and DOES read `POSTGRES_*` from `.env` (the opposite of the step 5 password test).
- `down -v` = `rm -rf` for the database. Never on a real server without a backup.
### Step 8
- `depends_on: [postgres]` = start postgres first; does NOT wait until it's ready (healthcheck = project 4). `restart: unless-stopped` = restart on crash, not after my own `stop`.
- Test: `kill $(pidof node)` inside api → RestartCount 2, back up by itself. `docker compose stop` → stays stopped (that's the "unless-stopped").
- `/health` stayed "ok" with postgres stopped while `/users` failed → my health check = **liveness** (process alive), not **readiness** (can it serve, e.g. DB reachable).
- `stop` = processes shut down, containers + network + volume kept (`start` resumes). `down` = containers + network removed, volume kept. `down -v` = volume too. Images never touched. `pause` = different (freezes processes).
- Network = Docker object (virtual switch + DNS). Holds no data → recreated on `up` for free; IPs may change → use names.
- Shell: `${VAR}` = variable, `$(cmd)` = run command and insert output. `${pidof node}` → "Bad substitution".
- On `stop`, logs show `npm error signal SIGTERM`, exit 1: npm is PID 1 and doesn't pass the signal on cleanly → run `node` directly in project 4.
### Step 9
- Cheat sheet check (2026-10-30): first pass was too picky on wording; re-checked → 💡 only for wrong concepts / unanswered parts: Q4, 8, 12, 13, 15, 17, 18, 19 + 3 table rows. R7 correct (streak 1). New weak spots → `REVIEW.md` R13–R16.

---

## Summary
- One `docker-compose.yaml` runs Postgres (named volume `pgdata`) + my NestJS api (built from my Dockerfile, office CA as a build secret). Both "Done when" criteria met: `up` starts everything, users survive `down`/`up`.
- Networking: Compose network + DNS → the api reaches the DB at `postgres:5432`. `localhost` = the container I'm in. `ports:` only publishes to my PC.
- Config: values in `.env` (ignored by git), `${VAR}` in the YAML, `.env.example` committed. `POSTGRES_*` only applies on first init of an empty volume.
- App: `users` module with TypeORM (`synchronize: true` for now), `POST/GET /users`, duplicate email → 409.
- Lifecycle: `stop` / `down` / `down -v`; `depends_on` = order only; `restart: unless-stopped` restarts crashes, not my own stops.
- Weak spots (see `REVIEW.md` R13–R16): anonymous volumes, how the CA secret flows through compose + Bake, `"user"` in psql, `git check-ignore`.
- Next topic suggestion: production images. Multi-stage build + alpine + non-root user (~1.9GB → <200MB), run `node` directly as PID 1 (fixes the `npm error signal SIGTERM`), a `HEALTHCHECK` and `depends_on: condition: service_healthy` so the api waits until Postgres is READY. Make `/health` check the DB (readiness).
