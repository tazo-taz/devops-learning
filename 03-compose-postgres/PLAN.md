# Project 3 — NestJS + Postgres with Docker Compose

**Goal:** Build a modular NestJS app (a `users` module with TypeORM) and run it together with Postgres using `docker-compose.yml`.
**You learn:** Compose, container networking (the app connects to the hostname `postgres`, not `localhost`), `.env` files, and volumes so data survives restarts.
**Done when:**
- [ ] `docker compose up` starts everything
- [ ] your users are still there after `docker compose down` and `up` again

> From project 2: I can write a Dockerfile and run ONE container with `docker run -p ... -e ...`.
> Now: several containers that must talk to each other. Instead of long `docker run` commands, we describe the whole setup in one file.
> Starting code = a copy of `02-dockerize-nestjs/api` (without `node_modules`/`dist`).

---

## Step 1 — First `docker-compose.yml`: only Postgres + a named volume
- Concept: Compose = a YAML file that lists your **services** (containers), their ports, env vars and volumes. `docker compose up` = all the `docker run` commands at once. A **named volume** = disk space managed by Docker that lives outside the container.
- File: `docker-compose.yml` (in `03-compose-postgres/`) with one service `postgres` (`image: postgres:16`, `POSTGRES_USER/PASSWORD/DB`, `ports: 5432:5432`, `volumes: pgdata:/var/lib/postgresql/data`).
- Commands: `docker compose up -d`, `docker compose ps`, `docker compose logs postgres`, `docker compose exec postgres psql -U app -d app`, `docker volume ls`
- ✅ Checkpoint: inside `psql`, `\l` lists your database. You can say what a service and a named volume are.

## Step 2 — Add the `api` service (build from the Dockerfile)
- Concept: a service can use `build:` (your Dockerfile) instead of `image:`. The office CA secret now goes in the compose file (`build.secrets` + top-level `secrets:`), because the `docker()` bash function doesn't cover `docker compose build`.
- Commands: `docker compose up -d --build`, `docker compose ps`, `curl localhost:3000/health`
- ✅ Checkpoint: both services run, `/health` answers. The image builds through the proxy.

## Step 3 — Container networking: who is `localhost`?
- Concept: Compose creates a network for the project. Every service can reach the others **by service name** (built-in DNS). Inside the api container, `localhost` = the api container itself, NOT your PC and NOT Postgres.
- Experiments: `docker network ls`, `docker compose exec api getent hosts postgres`, try reaching the DB at `localhost:5432` vs `postgres:5432` from inside api.
- ✅ Checkpoint: you can explain why the app must use host `postgres`, and why `ports:` on Postgres is only needed for tools on your PC.

## Step 4 — Connect NestJS to Postgres with TypeORM
- Concept: an ORM maps TypeScript classes (entities) to tables. NestJS config comes from env vars (`DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`), never hardcoded.
- Commands: `npm install @nestjs/typeorm typeorm pg` (on your PC, updates `package*.json`), `TypeOrmModule.forRootAsync(...)` in `app.module.ts`, env vars in the `api` service.
- `synchronize: true` creates tables automatically. OK for learning; real migrations come in project 5.
- ✅ Checkpoint: `docker compose logs api` shows a successful DB connection, no `ECONNREFUSED`.

## Step 5 — `.env` file: config out of the YAML
- Concept: secrets and settings belong in `.env` (not committed). Compose reads `.env` automatically for `${VAR}` substitution; `env_file:` passes variables into a container. Commit a `.env.example` with fake values.
- Commands: `docker compose config` (shows the final YAML with variables filled in), add `.env` to `.gitignore`.
- ✅ Checkpoint: no password in `docker-compose.yml`, `git status` doesn't show `.env`, everything still works.

## Step 6 — The `users` module (entity, service, controller)
- Concept: Nest module = one feature in a folder (module + controller + service + entity). Controller = HTTP, service = logic, repository = DB access.
- Commands: `npx nest g resource users` (or module/controller/service), `User` entity (`id`, `name`, `email`), `POST /users`, `GET /users`.
- Test: `curl -X POST localhost:3000/users -H 'Content-Type: application/json' -d '{"name":"Tazo","email":"t@example.com"}'`, then `curl localhost:3000/users`, and look at the table in `psql`.
- ✅ Checkpoint: a created user shows up in `GET /users` AND in `SELECT * FROM "user";`.

## Step 7 — Persistence test: `down`, `up`, `down -v`
- Concept: `docker compose down` removes containers + network, but **keeps named volumes**. `down -v` deletes the volumes too, so the data is gone.
- Commands: `docker compose down` → `docker compose up -d` → `curl localhost:3000/users` (still there?), then try `down -v` and see the difference.
- ✅ Checkpoint: users survive `down`/`up`. (Done criteria #1 and #2.) You know when `-v` destroys data.

## Step 8 — Startup order + everyday Compose commands
- Concept: `depends_on` starts Postgres first but does NOT wait until it's *ready*. Watch the api fail or retry on a cold start. `restart: unless-stopped`. (Proper waiting with healthchecks = project 4.)
- Commands: `docker compose restart api`, `docker compose logs -f`, `docker compose stop` vs `down`, `docker compose exec`, `docker compose up -d --build api`.
- ✅ Checkpoint: you can explain `stop` vs `down` vs `down -v`, and why `depends_on` alone isn't enough.

## Step 9 — Cleanup + cheat sheet
- `docker compose down`, write `CHEATSHEET.md` (compose file structure, networking, volumes, `.env`, commands) in your own words.
- ✅ Checkpoint: "Done when" boxes above are ticked.

---

## Notes / lessons learned
### Step 1
### Step 2
### Step 3
### Step 4
### Step 5
### Step 6
### Step 7
### Step 8
### Step 9

---

## Summary
_(written at the end)_
