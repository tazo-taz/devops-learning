# Project 1 — Docker basics (no code) ✅ COMPLETED 2026-10-29

**Goal:** Run ready-made containers (nginx, postgres, redis) and get comfortable with the core Docker CLI.
**You learn:** images vs containers, port mapping (`-p`), environment variables (`-e`).
**Done when:**
- [x] nginx opens in the browser at `http://localhost:8080` (container `web2`; `web` runs on 8081)
- [x] a table is created inside the containerized Postgres via `psql` (`students` in db `learn`)

> ⚠️ Port conflict on this machine: your `ms-*` stack already uses host ports **8080, 5432, 6379**.
> We either stop that stack while doing this lesson, or map to free ports (8081, 5433, 6380). Decided in Step 2.
> ✔ Resolved: native engine disabled on 2026-10-28, so 8080/5432/6379 are free now (see Step 2 notes).

---

## Step 1 — Images vs containers (concepts + first run) ✔ DONE
- Concept: an **image** is a read-only template (like a class); a **container** is a running instance of it (like an object).
- Commands: `docker images`, `docker pull nginx:alpine`, `docker run hello-world`
- ✅ Checkpoint: you can explain image vs container and see pulled images in `docker images`.

## Step 2 — nginx + port mapping (`-p`) ✔ DONE (on port 8081)
- Concept: containers have their own network; `-p HOST:CONTAINER` forwards a port on your machine into the container.
- Decide: stop the `ms-*` stack (frees 8080) or use `-p 8081:80`.
- Commands: `docker run -d --name web -p 8080:80 nginx:alpine`
- ✅ Checkpoint: browser shows "Welcome to nginx!" at localhost:8080.

## Step 3 — Inspecting containers: `ps`, `logs`, `exec` ✔ DONE
- Commands: `docker ps`, `docker ps -a`, `docker logs web`, `docker logs -f web`,
  `docker exec -it web sh` (look around, edit `/usr/share/nginx/html/index.html`)
- ✅ Checkpoint: you changed the nginx homepage from inside the container and saw your request in the logs.

## Step 4 — Lifecycle: `stop`, `start`, `rm`, `rmi` ✔ DONE
- Concept: stopped containers still exist (`ps -a`); removing a container deletes its changes (that's why the edited index.html is gone).
- Commands: `docker stop web`, `docker start web`, `docker rm web`, `docker rm -f`, `docker rmi`
- ✅ Checkpoint: you understand why your homepage edit disappears after `rm` + new `run`.

## Step 5 — Postgres + environment variables (`-e`) ✔ DONE
- Concept: many images are configured with env vars (`POSTGRES_PASSWORD`, `POSTGRES_USER`, `POSTGRES_DB`).
- Commands: `docker run -d --name pg -e POSTGRES_PASSWORD=secret -e POSTGRES_DB=learn -p 5432:5432 postgres:16`
  (try it once *without* the password to see it fail in `docker logs`)
- ✅ Checkpoint: `docker logs pg` shows "database system is ready to accept connections".

## Step 6 — Connect with `psql` and create a table ✔ DONE
- Commands: `docker exec -it pg psql -U postgres -d learn`
- SQL: `CREATE TABLE`, `INSERT`, `SELECT`, `\dt`, `\q`
- ✅ Checkpoint: table exists and returns rows. (Done criterion #2)

## Step 7 — Redis (practice everything solo) ✔ DONE
- Run redis with `-p`, then `docker exec -it redis redis-cli` → `SET`, `GET`, `KEYS *`
- ✅ Checkpoint: you ran, inspected and cleaned it up without looking at notes.

## Step 8 — Cleanup + cheat sheet ✔ DONE
- Remove all lesson containers, see `docker system df`, write `CHEATSHEET.md` in your own words.
- ✅ Checkpoint: "Done when" boxes above are ticked.

---

## Notes / lessons learned
### Step 1
- Image name format: `registry/namespace/name:tag` → `nginx:alpine` = `docker.io/library/nginx:alpine`. No tag = `:latest`.
- Mistake: `nginx@alpine` → "invalid reference format". `:` = tag (label), `@` = digest (`@sha256:...`, exact fingerprint).
- Images are made of **layers**; layers are shared between images (saves disk + download).
- `docker run` = pull (if missing) + create + start.
- Client (`docker` command) sends requests → daemon (`dockerd`) does the work.
- A container lives only as long as its main process. `docker ps` = running only, `docker ps -a` = all.
- `Exited (0)` = finished successfully; non-zero = error. Stopped containers still exist until `docker rm`.

### Step 2
- `-p HOST:CONTAINER` forwards a port on my computer into the container. `-p 8081:80` → localhost:8081 reaches nginx on port 80.
- `-d` = detached (background), `--name web` = my own name instead of a random one.
- Mistake: `docker un ...` → "unknown shorthand flag: 'd'". Errors show where the program got confused, not always where I made the mistake → check for typos first.
- Port conflict: "bind: address already in use" → another program owns that host port. `docker run` = create + start, so a failed start leaves a `Created` container behind → `docker rm` it first.
- This PC had two Docker engines (Docker Desktop + native engine with the `ms` project) sharing the same host ports. `docker --context default ps` shows the other one.
- PORTS column: `0.0.0.0:8081->80/tcp` = published (reachable from my PC); `3000/tcp` only = not published (only other containers can reach it).
- Inside, many containers can use the same port (each has its own network); on the host, each port can be used only once.
- Turned off the native engine: `sudo systemctl disable --now docker.service docker.socket` → "Cannot connect to the Docker daemon ... docker.sock" = daemon not running (or no permission).
- Mistake: reused `--name web` → "Conflict. The container name is already in use". Names are checked BEFORE create, so nothing to clean up (unlike the port error).
- `web` (8081) + `web2` (8080) = two containers from one image. `web2` started instantly because the image was already local (no pull).

### Step 3
- `docker logs <name>` = everything the container's program printed. `-f` = follow live (Ctrl+C stops watching, not the container), `--tail 5` = only the last 5 lines.
- nginx logs: startup scripts (`docker-entrypoint.sh`) → `[notice]` nginx start (16 worker processes) → access log, one line per request.
- `OS: Linux ...-linuxkit` → Docker Desktop runs containers inside a small VM (LinuxKit); the native engine runs them directly on my Linux.
- Access log line: `IP - - [time] "GET / HTTP/1.1" 200 896 "browser"` = who, when, what, status, bytes.
- Status codes: 200 OK, 304 not modified (browser cache), 404 not found (`/favicon.ico`, `/hello`), 5xx = server broken. 2xx good / 3xx redirect-cache / 4xx client mistake / 5xx server problem.
- `docker exec web2 <cmd>` runs a command inside a running container. `/usr/share/nginx/html/index.html` (896 bytes, same as in the log) = the welcome page; `50x.html` = server error page. Files exist only inside the container.
- `docker exec -it web2 sh`: `-i` keep input open, `-t` give a terminal; alpine has `sh`, not `bash`.
- Container restarted after reboot showed `Exited (255)` = not stopped cleanly (Docker/PC shut down). `docker start web web2` brings them back with same names/ports.
- Inside a container, `hostname` = short container ID (`1f2a28cf7d87` = web2 in `docker ps`).
- Edited `index.html` in web2 → localhost:8080 shows my page, 8081 (web) still "Welcome to nginx". Image is read-only and shared; each container gets its OWN writable layer on top. Changes live only in that container.
- Log confirmed it: `GET / 200 38` (38 bytes = my new page; original was 896).

### Step 4
- `docker stop web2` → container still exists (`docker ps -a`, Exited), port closed → browser "can't connect" (nothing listening).
- `docker start web2` → same container, same ID, my edited page was still there. Stop does NOT lose changes.
- `docker rm web2` + new `docker run` → brand new container (ID `1f2a28cf7d87` → `aa90c1944e80`), back to "Welcome to nginx". rm deletes the writable layer = my changes.
- stop = turn the PC off; rm = throw the PC away. Fix for losing data later: volumes.
- `docker rm web` on a running container → refused. Use `docker rm -f` (stop + remove in one go).
- `docker rmi nginx:alpine` → refused because containers use it. Even a STOPPED container blocks image removal.
- Cleanup order: containers first (`rm`), then images (`rmi`). Removed `blissful_sammet` + `hello-world` image.

### Step 5
- `-e NAME=value` passes environment variables to configure an image (docs on Docker Hub list them). postgres needs `POSTGRES_PASSWORD`; optional `POSTGRES_USER`, `POSTGRES_DB`.
- Without password → `Exited (1)` + log says password not specified. Debug habit: `docker ps -a` → Exited → `docker logs <name>`.
- Env vars are set at create time → can't add to an existing container; `docker rm` + `docker run` again.
- "ready to accept connections" appears twice on first start: temp start → init (CREATE DATABASE learn, set password) → shutdown → real start. Init runs only when the data folder is empty.

### Step 6
- `docker exec -it pg psql -U postgres -d learn` → psql client already inside the postgres image. `-U` user, `-d` database.
- Created `students (id SERIAL PRIMARY KEY, name TEXT, city TEXT)`, inserted 2 rows, `SELECT` returned them. `SERIAL` = auto-increment id.
- `\dt` lists tables, `\q` quits; backslash commands are psql shortcuts (no `;`), SQL needs `;` (missing `;` → prompt `learn-#` waits).

### Step 7
- Ran redis:7 solo (run -d -p 6379:6379, logs, `exec -it redis redis-cli` SET/GET/KEYS *, stop, rm). No password env var needed, unlike postgres.
- `-it` = `-i` (keep input open, my typing reaches the program) + `-t` (give it a terminal/prompt). Short flags can be combined.
- One-off command (`ls`, `cat`, `hostname`) → no flags. Interactive program (`sh`, `psql`, `redis-cli`) → `-it`.
- Without `-i` the shell exits immediately; without `-t` no prompt, looks broken. Don't mix up with `-d` (background).

### Step 8
- postgres image declares a VOLUME for `/var/lib/postgresql/data` → Docker auto-created an anonymous volume (random ID) for `pg` (`docker inspect pg` → Mounts).
- `docker rm -f pg` deletes the container but NOT the volume. A new `docker run` gets a NEW empty anonymous volume → looks like data is lost, but the old volume stays on disk as junk.
- Had 3 volumes for 1 pg container: leftovers from the first (failed) pg and from redis (also uses a volume for /data). Clean: `docker volume prune -a` (or `docker rm -v` to remove a container's anonymous volumes with it).
- Real fix (next project): named volume `-v pgdata:/var/lib/postgresql/data` → data survives rm + new run.
- Wrote CHEATSHEET.md in my own words. Review caught: `-p 8080:8080` for nginx is wrong → container side must be the port the app listens on (80).

---

## Summary
- Ran nginx, postgres and redis from ready-made images; both "Done when" criteria met.
- Core idea: image = read-only template, container = instance with its own writable layer (lost on `rm`), volume = storage outside the container (survives `rm`).
- Debug habit: `docker ps -a` → `docker logs <name>` → read the error carefully.
- Next topic suggestion: named volumes (`-v pgdata:/var/lib/postgresql/data`), then writing my own Dockerfile.
