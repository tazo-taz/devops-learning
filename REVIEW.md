# Review log — my mistakes and weak spots

Every mistake from any project lands here: wrong commands, misconceptions, and cheat sheet answers that got a 💡.
Each new cheat sheet re-asks 3–4 open items in a **new form** (different scenario, not the same wording) in its "Review from earlier projects" section.

- **Streak** = how many later cheat sheets in a row I answered it correctly without help. Wrong answer → back to 0.
- Streak **2** → move the row to "Mastered".
- **Asked in** = the cheat sheets that already re-asked it, so the next one picks something else first (oldest / lowest streak first).

## Open

| ID  | Topic | The mistake / misconception | From | Asked in | Streak |
|-----|-------|-----------------------------|------|----------|--------|
| R1  | Image names | `nginx@alpine` → "invalid reference format". `:` = tag, `@` = digest (`@sha256:...`). | P01 | P03 | 0 |
| R2  | Container names | Reused `--name web` → "Conflict". Names must be unique; checked before create, nothing to clean up. Cheat sheet (P04): added `.` to `docker run` (that's only for `docker build`). | P01 | P04 | 0 |
| R3  | Reading errors | `docker un` → "unknown shorthand flag: 'd'". The error shows where the program got confused, not where I typed wrong → check typos first. | P01 | P04 | 1 |
| R4  | HTTP status codes | 4xx = client's mistake, 5xx = server bug. Duplicate email should be 409, not 500. | P01, P03 | P04 | 0 |
| R5  | Build context | `docker build -t my-api` without `.` → "requires 1 argument". The `.` = folder `COPY` can see. | P02 | P04 | 0 |
| R6  | Stale code | Forgot `RUN npm run build` → image shipped my PC's old `dist/`. "It works" ≠ "it's correct". | P02 | P03 | 0 |
| R7  | Dockerfile vs shell | Pasted `RUN ...` into bash → "command not found". Dockerfile instructions only live in the Dockerfile. | P02 | P03 | 1 |
| R8  | Image vs container | `docker tag api ...` failed: `api` = container. Tags are for images (`docker images` vs `docker ps`). | P02 | P03 | 0 |
| R9  | Flags vs names | `docker compose up -d build` → "no such service: build". A word without `--` = service name. P05: `docker run --rm "$PWD/empty:/app" image` (forgot `-v`) → "repository name must be lowercase": the first word without a flag = the IMAGE. | P03, P05 | P03 | 0 |
| R10 | Unsaved file | Edited the YAML but didn't save → experiment showed the old result. Verify the file / `compose ps`. | P03 | P05 (Step 2: Dockerfile unsaved before check) | 0 |
| R11 | Env var names | `DB_DB` vs `DB_NAME` → worked by luck (`pg` default). Check with `docker compose exec api printenv`. | P03 | P03 | 0 |
| R12 | Rebuild needed? | `up -d` reuses the old image after code changes → `up -d --build`. Env/port change → only recreate. | P03 | P03, P05 | 1 |
| R13 | Volume names | Thought `pgdata` was named because it's Postgres. I named it in the YAML; Compose adds the project (folder) name in front. Hash name = anonymous volume. | P03 | P04 | 1 |
| R14 | `.env` + git | Didn't know `git check-ignore -v .env` (asks which `.gitignore` line ignores it, no output = not ignored). Compose auto-reads `.env` next to the YAML. | P03 | P04 | 0 |
| R15 | Proxy CA in compose | Forgot: `build.secrets: [ca]` uses + top-level `secrets: ca: file:` defines; Bake blocks files outside the project → `BUILDX_BAKE_ENTITLEMENTS_FS=0`. | P03 | P05 | 1 |
| R16 | psql | `user` is reserved → `"user"` in quotes. `psql -d` = database, not password. | P03 | P05 | 1 |
| R17 | Look before guessing | 500 → guessed "probably the DB connection" instead of looking. First `docker compose logs api` and read the real error (in P03 it was a duplicate key, not the connection). | P04 | | 0 |
| R18 | COPY source | Multi-stage: wrote `COPY dist .` in the final stage. Without `--from=build` COPY reads from the build CONTEXT (my PC, where `dist` is dockerignored) → need `COPY --from=build /app/dist ./dist`. Also `COPY dir .` copies the folder's CONTENTS, not the folder. (Same family as R6: don't ship my PC's `dist`.) | P04 | | 0 |
| R19 | Smallest fix first | api lost its network (DNS `EAI_AGAIN postgres`), I guessed an auth problem (P03 password lesson) without matching it to the log → fixed with `down -v`, which also deleted the DB. Containers/network problem → `down` + `up` (or `up -d --force-recreate api`) is enough; `-v` only when I WANT the data gone. P05: wanted to empty the DB, reached for `docker volume prune` (skips volumes in use + named ones by default) → the command is `docker compose -f ... down -v`. | P04 | | 0 |
| R20 | PID 1 + signals | Thought npm as PID 1 gives a graceful shutdown. No: npm passes SIGTERM to node, node has no handler → dies instantly without cleanup → npm reports `npm error signal SIGTERM`, exit 1. Graceful = the app itself is PID 1 AND handles SIGTERM (`enableShutdownHooks()`), or an init (`init: true`) forwards it. Cheat sheet (P04): didn't know 137 = 128+9 = SIGKILL after the stop timeout, nor `init: true`; shell form `CMD node ...` → `/bin/sh -c` is PID 1. | P04 | | 0 |
| R21 | exec + shell | `exec api echo x > file` → `>` ran on MY PC (made a file `cat`). `exec api -c "ls"` → "-c not found": first word after the service = the program, so `sh -c '...'`. `ls app` in WORKDIR `/app` = `/app/app` → use `/app`. P05: `exec sh` without a service name, and exec on an EXITED container (use `logs`, or `run --rm <svc> sh`). Step 8: `exec api -c "npm run ..."` again (no `sh`; not needed at all). | P04 | | 0 |
| R22 | File ownership | Predicted `USER node` can write in `/app`. No: `WORKDIR`/`COPY` create files as root (`drwxr-xr-x root root`) → `node` can only read. Writable folder → `COPY --chown=node:node` / `chown` in a RUN before `USER node`. Break 3 (P04): said "a user only gets read by default" (it's the root OWNERSHIP + others bits `r-x`) and didn't know why `chown` must come before `USER node`: only root can change ownership; after `USER node` every RUN runs as node → `chown` fails the build ("Operation not permitted"). | P04 | | 0 |
| R23 | YAML structure | `healthcheck:` indented deeper than its siblings (`image:`) → "did not find expected key". Indent = nesting: same level = same number of spaces. `depends_on:` long form needs the service name level: `postgres:` → `condition: service_healthy`. Check with `docker compose config -q`. | P04 | | 0 |
| R24 | `depends_on` | Mixed up `depends_on` with the api's `/health`. Short form `depends_on: [postgres]` = only START order (postgres container started, maybe not ready yet). `condition: service_healthy` = wait until postgres' OWN healthcheck (`pg_isready`) passes. The api's `/health` doesn't play a role in that. | P04 | | 0 |
| R25 | RUN vs CMD | Solo run (P04): wrote `cmd npm run build` in the build stage. `RUN` = runs DURING the build and saves the result in a layer; `CMD` = only the default command when a container STARTS (and only the last CMD of the final stage counts). → `dist/` never built, `COPY --from=build` fails. | P04 | | 0 |
| R26 | Healthcheck target | Solo run (P04): healthcheck called `/` instead of `/health`. `/` only proves the process answers (liveness); `/health` runs `SELECT 1`, so healthy = DB reachable too (readiness). | P04 | | 0 |
| R27 | Measuring size | Cheat sheet (P04): said `docker compose image` to see where size comes from. Layers + sizes = `docker history <image>`. P03 image: `node:24` base ≈ 1.2 GB + `npm ci` with dev deps ≈ 278 MB. | P04 | | 0 |
| R28 | Alpine differences | Cheat sheet (P04): only named "no curl". Also: `sh` not `bash`, `apk` not `apt`, musl instead of glibc (some native npm packages break). | P04 | | 0 |
| R29 | Multi-stage | Cheat sheet (P04): why dev deps aren't in the final image, missed "stage 1 is thrown away": only the LAST stage becomes the image, `COPY --from` takes only what you name. | P04 | P05 | 1 |
| R30 | Debug unhealthy | P05: needed a reminder of `docker inspect <c> --format '{{json .Mounts}}'` to check a mount's `RW`. Cheat sheet (P04): "look at the Dockerfile" instead of tools. `docker inspect <c> --format '{{json .State.Health}}'` (results + exit codes) and `'{{json .Config.Healthcheck}}'` (the real test, compose may override it). | P04, P05 | | 0 |
| R31 | Who acts on unhealthy | Cheat sheet (P04): thought only a person reacts. Plain Docker only MARKS it; load balancers stop sending traffic, Kubernetes restarts / removes from service. | P04 | | 0 |
| R32 | Command meanings | Cheat sheet (P04): `exec api id` = the uid/gid the process runs as (not a container ID); `up --force-recreate` = delete + create a NEW container (not a restart); `image prune` = only dangling `<none>` images. Also mixed image/container (history = image layers, health = container) → see R8. | P04 | | 0 |
| R33 | Compose `-f` files | Ran `docker compose run/up` WITHOUT `-f` → only `docker-compose.yaml` is read (+ `compose.override.yaml` if it exists) → no dev settings, no target → last stage = prod. Every command (`up`, `ps`, `logs`, `run`, `config`) needs the same `-f` list (or `COMPOSE_FILE`). Step 5: `logs pgadmin` without `-f` → "no such service" (but `ps` showed it). Step 7 (with `COMPOSE_FILE` = dev in `.env`): ran prod `up` without `-f` → got DEV back (pgadmin, start:dev, bind mount). Check: label `com.docker.compose.project.config_files`. | P05 | | 0 |
| R34 | Mount syntax | Read `./api:/app:ro` as path `/app/ro`. Format = `host:container[:mode]`; `ro` = read-only (default `rw`). Files are visible, only writes fail (`EROFS`). Dev needs `rw` (nest writes `dist/`); `:ro` is fine for config files a container only reads. | P05 | | 0 |
| R35 | Port order | Fixing pgAdmin's port wrote `"80:5050"`. `ports:` / `-p` = `HOST:CONTAINER`: left = port on my PC (browser uses it), right = port the app listens on INSIDE (pgAdmin: 80). Same order as volumes `host:container`. | P05 | | 0 |
| R36 | Migrations tracking | Predicted a re-run is skipped "because the changes are already in pg". TypeORM doesn't compare tables: it reads its `migrations` table (names of migrations already run) and only runs the missing ones. The SQL itself would fail a 2nd time (`already exists`). | P05 | P05 (mini break-it) | 1 |
| R37 | Admin tools in prod | Thought pgAdmin in prod "would not be an issue". It is an extra internet-facing login page with FULL DB access (here even `admin/admin`) = attack surface. Prod: no admin UIs running; when needed, open one temporarily and only locally (SSH tunnel / `--profile`, never a public port). | P05 | | 0 |
| R38 | Anonymous volume stale | New npm package + `up -d --build` → `Cannot find module` in dev. The `- /app/node_modules` anonymous volume is filled from the image only ONCE (when empty); compose reuses it on every recreate, so it hides the new image's node_modules. Fix: `up -d -V` (`--renew-anon-volumes`, keeps named volumes like pgdata), not `down -v` (deletes the DB too). Mixed up `-v` / `-V`. | P05 | | 0 |

## Mastered

| ID | Topic | Mastered in |
|----|-------|-------------|
