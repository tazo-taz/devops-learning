# Project 4 — Production-ready images ✅ COMPLETED 2026-11-03

**Goal:** Improve project 3's api image: multi-stage build (build stage + small run stage), alpine base, non-root user, a `HEALTHCHECK`, and make the api wait until Postgres is healthy (`depends_on: condition: service_healthy`).
**You learn:** image size optimization and basic container security.
**Done when:**
- [x] the api image shrinks from about 1 GB+ to under 200 MB (2.01 GB → 75 MB compressed / ~252 MB unpacked, Node alone = 167 MB)
- [x] (extra) `docker compose up` on a cold start: api waits for a healthy Postgres, both show `(healthy)` in `docker compose ps`

> From project 3: one `docker-compose.yaml` runs Postgres + my api; `depends_on` only orders the start, `/health` = liveness only, `npm` as PID 1 → `npm error signal SIGTERM` on stop.
> Now: make the image small, safe and honest about its health.
> Starting code = a copy of `03-compose-postgres/` (without `node_modules`/`dist`, `.env` copied over, still git-ignored).

---

## Step 0 — Warm-up (no notes) ✔ DONE
- 3 recall questions in chat: from project 3 + open `REVIEW.md` items. Update streaks.

## Step 1 — Measure the starting point ✔ DONE
- Concept: you can't optimize what you don't measure. Image size = base image + every layer. `docker history` shows which layer is big.
- 🤔 Predict: the api image from project 3 — how big do you think it is, and which layer is the biggest?
- Commands: `docker compose build api`, `docker images`, `docker history 04-prod-images-api`, `docker compose exec api ls /app` (what's inside: `src/`, `node_modules` with dev deps, `test/`...).
- ✅ Checkpoint: you have the "before" number written down and can say *why* it's that big (base image + dev dependencies + source code nobody needs at runtime).

## Step 2 — Alpine base image ✔ DONE
- Concept: `node:24` = full Debian (compilers, tools). `node:24-alpine` = minimal Linux (musl, `sh` not `bash`, `apk` not `apt`). Less stuff = smaller + fewer CVEs.
- 🤔 Predict: if you only change `FROM node:24` → `FROM node:24-alpine`, how much smaller will it get? Will the CA secret still work?
- Commands: change `FROM`, `docker compose build api`, `docker images`.
- ✅ Checkpoint: new size noted. Why: what did we remove, and what could break on alpine?

## Step 3 — Multi-stage build ✔ DONE
- Concept: stage 1 (`AS build`) installs ALL deps and compiles TS → `dist/`. Stage 2 starts fresh from alpine, installs only production deps (`npm ci --omit=dev`) and `COPY --from=build /app/dist`. Only the last stage becomes the image.
- 🤔 Predict: which files does the final stage need to run `node dist/main`? (Name them.)
- Commands: rewrite the `Dockerfile` with two `FROM`s, `docker compose build api`, `docker images`, `docker history`.
- ✅ Checkpoint: image under 200 MB (Done when #1), `/users` still works. Why: why does `typescript`/`@nestjs/cli` not end up in the final image?

## Step 4 — `node` as PID 1 (clean shutdown) ✔ DONE
- Concept: `CMD ["npm", "run", "start:prod"]` → npm is PID 1 and handles signals badly. `CMD ["node", "dist/main"]` → node gets SIGTERM directly. Exec form `[...]` vs shell form.
- 🤔 Predict: after the change, what exit code will `docker compose stop api` give, and will the `npm error signal SIGTERM` line still appear?
- Commands: change `CMD`, `docker compose up -d --build`, `docker compose exec api ps`, `docker compose stop api`, `docker compose ps -a`.
- ✅ Checkpoint: clean stop (no npm error). Why: what is PID 1 and why does it matter for `docker stop`?

## Step 5 — Non-root user ✔ DONE
- Concept: by default containers run as `root`. If the app is hacked, the attacker is root inside the container. `node` images ship a `node` user → `USER node`. Files copied in are owned by root unless `COPY --chown=node:node`.
- 🤔 Predict: `docker compose exec api whoami` right now prints what? After `USER node`?
- Commands: `USER node` in the final stage, `--chown`, rebuild, `whoami`, `id`, try `touch /app/x`.
- ✅ Checkpoint: app runs as `node`. Why: what's the risk of root, and why can't `node` write everywhere?

## Step 6 — Healthchecks + readiness ✔ DONE
- Concept: `HEALTHCHECK` = Docker runs a command every N seconds → status `starting` / `healthy` / `unhealthy`. Postgres: `pg_isready`. Api: `/health` should also check the DB (readiness, project 3 step 8). `depends_on: postgres: condition: service_healthy` = wait for READY, not just started.
- 🤔 Predict: alpine has no `curl`. How will the api healthcheck call `/health`?
- Commands: `healthcheck:` for postgres in compose, `HEALTHCHECK` in the Dockerfile (or compose), `/health` with a DB ping (Claude writes the Nest part), `docker compose down && docker compose up -d`, `docker compose ps`, `docker inspect --format '{{json .State.Health}}'`.
- ✅ Checkpoint: both `(healthy)`; api only starts after Postgres is healthy; stopping postgres → api turns `unhealthy`. Why: liveness vs readiness, and why `depends_on` alone wasn't enough.

## Step 7 — Break it ✔ DONE
- Claude breaks something (scenarios from `ROADMAP.md`): non-root user can't write to a folder, healthcheck that always fails, missing file in the final stage ("Cannot find module"). Only the symptom is given.
- Loop: symptom → look (`logs`, `ps`, `inspect`, `exec`) → guess → test → fix → explain. No hints for the first few minutes.
- ✅ Checkpoint: each one fixed and explained in your own words.

## Step 8 — Solo run ✔ DONE (as a plan in words, `DockerFileOwn`)
- From an empty `Dockerfile`: write the multi-stage, alpine, non-root, healthcheck Dockerfile without notes, build, run with compose, check size + health. Claude only watches. Lookups → `REVIEW.md`.
- ✅ Checkpoint: works without notes, size < 200 MB.

## Step 9 — Cleanup + cheat sheet ✔ DONE (2026-11-03)
- `docker compose down`, `docker image prune` (old dangling images). `CHEATSHEET.md` as questions; I answer, Claude puts 💡 suggestions in the file.
- ✅ Checkpoint: "Done when" boxes ticked, Summary written.

---

## Notes / lessons learned
### Step 0
- Q1 (500 on `/users`): guessed "DB connection" without a command. First look: `docker compose logs api` and read the stack trace. → R17
- Q2 (R5, wrong): said `-f` isn't needed. `-f` is fine; the problem is the context `.` = `04-prod-images/`, so `COPY package*.json` looks for `04-prod-images/package.json`. Fix: `docker build -t api-prod api`. COPY paths are relative to the CONTEXT, not to the Dockerfile.
- Q3 (R13, correct): new folder = new project name → new volume `04-prod-images_pgdata` (project + VOLUME name) → empty DB, the P03 users stay in `03-compose-postgres_pgdata`.
### Step 1
- **Before: `docker images` = 2.01 GB** (history sum ≈ 1.5 GB; Docker Desktop also counts the compressed layer copies).
- `docker compose build api` = only build (measure), `up -d --build` = build + start. Same image.
- `docker history`: `node:24` base ≈ 1.2 GB (biggest layer 619 MB = gcc/make/python build tools, Node binary 218 MB), `npm ci` 278 MB (incl. dev deps: typescript, nest cli, vitest), my code < 1 MB. `<missing>` = layer without its own local ID (normal), `0B` rows = metadata only.
- Why so big: mostly stuff the RUNNING app never uses (build tools, dev deps). Image = OS files (Debian userland), not a virtual machine: no kernel inside, the container shares the host kernel.
### Step 2
- `node:24-alpine`: 2.01 GB → **619 MB**. Base now ≈ 180 MB (Alpine 9 MB + Node 167 MB) instead of ≈ 1.2 GB. CA secret + `npm ci` still worked (it's Node's `NODE_EXTRA_CA_CERTS`, not the OS).
- Now the biggest layer = `npm ci` 279 MB (dev deps) → multi-stage next.
### Step 3
- Mistake: `COPY dist .` in the final stage → reads from my PC (context), not the build stage; `dist` is in `.dockerignore` anyway. Fix: `COPY --from=build /app/dist ./dist`. `COPY dir .` = contents of dir, not the dir itself. → R18
- After `up`: api logs `getaddrinfo EAI_AGAIN postgres` (DNS lookup failed) + `ps` showed `3000/tcp` without `0.0.0.0:3000->`. `docker inspect` → api's `Networks: {}` = container NOT attached to the compose network (postgres was). Probably a Docker Desktop glitch while the container restarted. Fixed by recreating the containers. I used `down -v`, which also wiped the DB; `down` + `up` would have been enough. I thought it was auth (P03 password lesson), but auth looks like `password authentication failed`, not `EAI_AGAIN`; the 04 volume was brand new with the same `.env` anyway. → R19 + R17 (read the error first)
- Why dev deps aren't in the final image: stage 2 installs with `--omit=dev`, AND stage 1 (which had them) is thrown away; `COPY --from=build` only takes `dist`.
- Size: `docker image ls` now shows DISK USAGE 328 MB / CONTENT SIZE 75 MB. Layers: alpine+node ≈ 180 MB, prod `npm ci` 71 MB (was 279), dist 139 kB → ≈ 252 MB unpacked.
- Instructions are case-insensitive (`from`, `copy` work) but convention = UPPERCASE; mixed `FROM ... as` gives a BuildKit warning (FromAsCasing).
### Step 4
- Before: PID 1 = `npm run start:prod`, node = PID 18 (child). Docker's SIGTERM goes only to PID 1.
- `CMD ["node", "dist/main"]` → node = PID 1. But `stop` → `Exited (137)` = 128 + 9 = SIGKILL: node ignored SIGTERM, Docker waited, then killed it.
- Why: Linux gives PID 1 no default "die on SIGTERM"; PID 1 must handle the signal itself, and plain Node doesn't. Fix: `app.enableShutdownHooks()` in `main.ts` (Nest catches SIGTERM, closes server + DB). Alternative without code: `init: true` in compose (tiny init `tini` becomes PID 1 and forwards signals).
- After `enableShutdownHooks()`: `Exited (0)`. Exit 137 = force-killed → open requests cut off, DB connections not closed, half-written work lost.
- Mistake: thought npm as PID 1 = graceful shutdown. It's the opposite (npm error, exit 1). → R20
### Step 5
- Shell lessons: `exec api echo x > file` → `>` handled by MY bash (created `./cat` on my PC). Inside the container: `exec api sh -c 'echo x > /app/f'`. `exec api -c "ls"` → "-c not found": the first word after the service name is the PROGRAM. `ls app` from WORKDIR `/app` = `/app/app` (relative path). → R21
- `USER node` → `whoami` = node, uid 1000. App still works (200). `touch /app/x` → Permission denied.
- Mistake: predicted node can write in `/app`. `WORKDIR` + `COPY` run as root → `/app` = `drwxr-xr-x root root` → others = read + enter only. That's GOOD for code (a hacked app can't rewrite itself). For a folder the app must write to: `RUN mkdir /app/uploads && chown node:node /app/uploads` (before `USER node`) or `COPY --chown=node:node`. → R22
- `USER node   # comment` → "unable to find user node   # from here on...": Dockerfile comments only work at the START of a line; inline `#` becomes part of the value. (In `RUN` it worked because the shell treats `#` as a comment.) Snippet came from Claude.
- Result: `whoami` = node, `/app/uploads` writable, `/app` denied. Reading works because the files' permissions give "others" `r` (`rw-r--r--`, `r-x` on folders), not because read is "always on": `chmod 600` would lock node out.
### Step 6
- `/health` now runs `SELECT 1` (Claude wrote it): 200 if DB up, 503 if down = readiness.
- No curl on alpine → healthcheck with `node -e "fetch(...)"` (exit 0 = healthy, 1 = unhealthy). `wget` from busybox would work too.
- Mistakes in compose: `healthcheck:` indented 6 spaces instead of 4 (siblings must line up) → "did not find expected key"; `depends_on:` long form missing the `postgres:` level. → R23
- Cold start: api CREATED 9 s ago but Up 3 s → waited for postgres `(healthy)`. Then api `health: starting` → `healthy`.
- `stop postgres` → `/health` 503 `{"db":"down"}`, api `(unhealthy)` after 3 failed checks, but still `Up`: plain Docker only MARKS unhealthy, doesn't restart (K8s / load balancers act on it). `start postgres` → healthy again by itself.
- Liveness = process alive; readiness = can really serve (DB reachable).
- Mistake: said plain `depends_on` wasn't enough "because /health didn't return an error". Wrong link: short `depends_on` = start order only; `service_healthy` waits for postgres' own `pg_isready` check. → R24
### Step 7
- Break 1 (missing file in final stage): Claude changed `COPY --from=build /app/dist ./build`. Symptom: api `Restarting (1)`, logs "Cannot find module '/app/dist/main'". Found it. First fix = changed `CMD` to `node build/main` (works, but adapts to the bug: `dist` is the convention, `start:prod` in package.json still says `dist/main`). Root-cause fix = put `./dist` back in the COPY.
- Can't `exec` into a crash-looping container → `docker compose run --rm api sh` (new container, `sh` replaces CMD) or `docker run --rm -it <image> sh`. Also `logs` (which path it wants) + `history` (where COPY put it).
- Break 2 (healthcheck always fails): Claude added a compose `healthcheck:` calling port 3001. Symptom: `(unhealthy)` but `curl :3000/health` = 200. Found it by seeing Claude's diff in the editor, not with Docker tools. The tool path: `docker inspect <c> --format '{{json .State.Health.Log}}'` (exit 1 each time) → `'{{json .Config.Healthcheck}}'` (3001) → compare with the working curl. Compose `healthcheck:` REPLACES the Dockerfile `HEALTHCHECK` (like `command:` vs `CMD`, `user:` vs `USER`) → keep one copy.
- Break 3 (non-root can't write): app now writes `uploads/last-start.txt` at boot (Claude added it openly); Claude removed `&& chown node:node /app/uploads` from the Dockerfile. Symptom: api `Restarting (1)`, logs `EACCES: permission denied, open 'uploads/last-start.txt'`. Loop: `ps` → `logs` → EACCES = permissions → which user runs it → fixed with `RUN chown -R node:node /app/uploads` before `USER node`. Tidier: one `RUN mkdir ... && chown ...` (one layer). Tool path without files: `docker compose run --rm api sh -c 'id; ls -ld /app/uploads'` (node vs root root).
- Mistake: said "a user only gets read by default". Really: everything before `USER node` runs as root → folder `root root drwxr-xr-x` → node = "others" = `r-x`. And `chown` must come BEFORE `USER node` because only root can change ownership; after it, `RUN chown` runs as node → build fails "Operation not permitted". → R22
### Step 8
- Couldn't write the Dockerfile from a blank file → wrote it in words instead (`DockerFileOwn`), Claude put 💡 in the file. Got right: 2 stages, WORKDIR, package files first, CA secret on both `npm ci`, `--omit=dev`, `COPY --from=build`, `USER node`, healthcheck exit-code logic, `node dist/main`.
- Wrote the IDEA, not code (judge concepts only). Idea mistakes: `cmd npm run build` instead of RUN (→ R25), forgot uploads chown (→ R22), healthcheck on `/` instead of `/health` (→ R26).
### Step 9
- Cheat sheet first check (2026-11-03): 14 answers + 5 command rows got a 💡. New REVIEW rows R27–R32; resets/notes on R2, R4, R8, R14, R18, R20, R22, R26; R3 correct (streak 1).
- Second check: 7 more fixed by me; Claude wrote the answers for Q7, Q8, Q9, Q12, Q17, Q19, Q20 + 4 command rows (PID 1 shell vs exec form, `init: true`, inspect healthcheck, `git check-ignore`, prune = dangling only).

---

## Summary
- Api image: `node:24` single stage **2.01 GB → 75 MB compressed / ~252 MB unpacked** (multi-stage, `node:24-alpine`, prod deps only, `COPY --from=build /app/dist`). Both "Done when" criteria met.
- PID 1: `CMD ["node", "dist/main"]` (exec form) + `app.enableShutdownHooks()` → `docker stop` = `Exited (0)` instead of 137 / npm error.
- Security: runs as `USER node`; code in `/app` is read-only for the app, only `/app/uploads` is chowned (as root, BEFORE `USER node`).
- Health: `/health` = readiness (`SELECT 1`, 503 if DB down), Dockerfile `HEALTHCHECK` via `node -e fetch(...)` (no curl on alpine), postgres `pg_isready`, `depends_on: condition: service_healthy`. Docker only MARKS unhealthy; LBs / K8s act on it.
- Debugging tools learned: `docker history`, `docker inspect --format '{{json .State.Health}}'` / `.Config.Healthcheck`, `docker compose run --rm api sh` for crash-looping containers, exit codes (137 = SIGKILL).
- Solo run: couldn't write the Dockerfile from a blank file; wrote it as a plan in words (`DockerFileOwn`), ideas all correct after 3 hints (RUN vs CMD, uploads chown, `/health`).
- Weak spots (REVIEW.md R17–R32): PID 1 + signals, file ownership, healthcheck debugging with inspect, `git check-ignore`, HTTP 500 vs 503, Dockerfile syntax from memory.
- Next topic suggestion: dev vs prod environments (project 5). Dev = hot reload with a bind mount (`src/` mounted in, `npm run start:dev`), prod = this image. One base `docker-compose.yaml` + `compose.override.yaml` for dev (or `-f` files / profiles), multi-stage `target:` (a `dev` stage vs the final stage), and the `node_modules` volume trick so the host's folder doesn't hide the container's. Re-practice writing the Dockerfile by hand there.

