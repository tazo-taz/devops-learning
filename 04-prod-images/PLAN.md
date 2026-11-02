# Project 4 — Production-ready images

**Goal:** Improve project 3's api image: multi-stage build (build stage + small run stage), alpine base, non-root user, a `HEALTHCHECK`, and make the api wait until Postgres is healthy (`depends_on: condition: service_healthy`).
**You learn:** image size optimization and basic container security.
**Done when:**
- [ ] the api image shrinks from about 1 GB+ to under 200 MB
- [ ] (extra) `docker compose up` on a cold start: api waits for a healthy Postgres, both show `(healthy)` in `docker compose ps`

> From project 3: one `docker-compose.yaml` runs Postgres + my api; `depends_on` only orders the start, `/health` = liveness only, `npm` as PID 1 → `npm error signal SIGTERM` on stop.
> Now: make the image small, safe and honest about its health.
> Starting code = a copy of `03-compose-postgres/` (without `node_modules`/`dist`, `.env` copied over, still git-ignored).

---

## Step 0 — Warm-up (no notes)
- 3 recall questions in chat: from project 3 + open `REVIEW.md` items. Update streaks.

## Step 1 — Measure the starting point
- Concept: you can't optimize what you don't measure. Image size = base image + every layer. `docker history` shows which layer is big.
- 🤔 Predict: the api image from project 3 — how big do you think it is, and which layer is the biggest?
- Commands: `docker compose build api`, `docker images`, `docker history 04-prod-images-api`, `docker compose exec api ls /app` (what's inside: `src/`, `node_modules` with dev deps, `test/`...).
- ✅ Checkpoint: you have the "before" number written down and can say *why* it's that big (base image + dev dependencies + source code nobody needs at runtime).

## Step 2 — Alpine base image
- Concept: `node:24` = full Debian (compilers, tools). `node:24-alpine` = minimal Linux (musl, `sh` not `bash`, `apk` not `apt`). Less stuff = smaller + fewer CVEs.
- 🤔 Predict: if you only change `FROM node:24` → `FROM node:24-alpine`, how much smaller will it get? Will the CA secret still work?
- Commands: change `FROM`, `docker compose build api`, `docker images`.
- ✅ Checkpoint: new size noted. Why: what did we remove, and what could break on alpine?

## Step 3 — Multi-stage build
- Concept: stage 1 (`AS build`) installs ALL deps and compiles TS → `dist/`. Stage 2 starts fresh from alpine, installs only production deps (`npm ci --omit=dev`) and `COPY --from=build /app/dist`. Only the last stage becomes the image.
- 🤔 Predict: which files does the final stage need to run `node dist/main`? (Name them.)
- Commands: rewrite the `Dockerfile` with two `FROM`s, `docker compose build api`, `docker images`, `docker history`.
- ✅ Checkpoint: image under 200 MB (Done when #1), `/users` still works. Why: why does `typescript`/`@nestjs/cli` not end up in the final image?

## Step 4 — `node` as PID 1 (clean shutdown)
- Concept: `CMD ["npm", "run", "start:prod"]` → npm is PID 1 and handles signals badly. `CMD ["node", "dist/main"]` → node gets SIGTERM directly. Exec form `[...]` vs shell form.
- 🤔 Predict: after the change, what exit code will `docker compose stop api` give, and will the `npm error signal SIGTERM` line still appear?
- Commands: change `CMD`, `docker compose up -d --build`, `docker compose exec api ps`, `docker compose stop api`, `docker compose ps -a`.
- ✅ Checkpoint: clean stop (no npm error). Why: what is PID 1 and why does it matter for `docker stop`?

## Step 5 — Non-root user
- Concept: by default containers run as `root`. If the app is hacked, the attacker is root inside the container. `node` images ship a `node` user → `USER node`. Files copied in are owned by root unless `COPY --chown=node:node`.
- 🤔 Predict: `docker compose exec api whoami` right now prints what? After `USER node`?
- Commands: `USER node` in the final stage, `--chown`, rebuild, `whoami`, `id`, try `touch /app/x`.
- ✅ Checkpoint: app runs as `node`. Why: what's the risk of root, and why can't `node` write everywhere?

## Step 6 — Healthchecks + readiness
- Concept: `HEALTHCHECK` = Docker runs a command every N seconds → status `starting` / `healthy` / `unhealthy`. Postgres: `pg_isready`. Api: `/health` should also check the DB (readiness, project 3 step 8). `depends_on: postgres: condition: service_healthy` = wait for READY, not just started.
- 🤔 Predict: alpine has no `curl`. How will the api healthcheck call `/health`?
- Commands: `healthcheck:` for postgres in compose, `HEALTHCHECK` in the Dockerfile (or compose), `/health` with a DB ping (Claude writes the Nest part), `docker compose down && docker compose up -d`, `docker compose ps`, `docker inspect --format '{{json .State.Health}}'`.
- ✅ Checkpoint: both `(healthy)`; api only starts after Postgres is healthy; stopping postgres → api turns `unhealthy`. Why: liveness vs readiness, and why `depends_on` alone wasn't enough.

## Step 7 — Break it
- Claude breaks something (scenarios from `ROADMAP.md`): non-root user can't write to a folder, healthcheck that always fails, missing file in the final stage ("Cannot find module"). Only the symptom is given.
- Loop: symptom → look (`logs`, `ps`, `inspect`, `exec`) → guess → test → fix → explain. No hints for the first few minutes.
- ✅ Checkpoint: each one fixed and explained in your own words.

## Step 8 — Solo run
- From an empty `Dockerfile`: write the multi-stage, alpine, non-root, healthcheck Dockerfile without notes, build, run with compose, check size + health. Claude only watches. Lookups → `REVIEW.md`.
- ✅ Checkpoint: works without notes, size < 200 MB.

## Step 9 — Cleanup + cheat sheet
- `docker compose down`, `docker image prune` (old dangling images). `CHEATSHEET.md` as questions; I answer, Claude puts 💡 suggestions in the file.
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

---

## Summary
