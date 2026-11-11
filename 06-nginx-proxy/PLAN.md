# Project 6 — Nginx reverse proxy + multiple services

**Goal:** Put Nginx in front of everything: `/api` goes to NestJS, `/` goes to a small frontend. Run 2 copies of the api behind Nginx and add Redis for caching.
**You learn:** reverse proxies, routing, load balancing (2 copies of the API), and caching.
**Done when:**
- [x] everything is reachable through a single port 80 (frontend at `/`, api at `/api/...`), and nothing else is published in prod
- [x] (extra) 2 api copies answer in turn, and `GET /api/users` is served from Redis on the second call

> From project 5: dev stage + bind mount hot reload, base + dev/prod compose overrides (`COMPOSE_FILE` in `.env`), one-shot `migrate` service, pgAdmin in dev.
> Problem now: the api is published directly on port 3000. Real sites have ONE entry point (80/443) that routes to many services, can spread load over several copies, and caches.
> Starting code = a copy of `05-dev-vs-prod/` (without `node_modules`/`dist`/`uploads`, `.env` copied, still git-ignored). New folder = new compose project = new empty volume `06-nginx-proxy_pgdata`.
> Method: Explain-it, not memorize. Looking up syntax (nginx config!) is fine; what matters is knowing WHAT exists and WHY.

Every step ends with 🔨 mini break-it(s): Claude quietly breaks one thing and gives only the symptom. Keep the files closed until you've looked with `ps` / `logs` / `inspect` / `exec`.

---

## Step 0 — Warm-up (no notes) ✔ DONE
- 3 recall questions in chat: 1 from project 5, 2 open `REVIEW.md` items. Update streaks.

## Step 1 — What a reverse proxy is (Nginx alone) ✔
- Concept: a reverse proxy = one front door; the client only talks to Nginx, Nginx forwards to services on the internal network and passes the answer back. vs. a normal (forward) proxy, which sits on the client's side (like the corporate proxy).
- 🤔 Predict: you run `nginx:alpine` with `-p 8080:80` and open `localhost:8080`. What do you see, and where does that page live inside the container?
- Commands: `docker run --rm -d -p 8080:80 nginx:alpine`, `curl`, `exec ... cat /etc/nginx/conf.d/default.conf`, `nginx -t`, `docker logs` (access log).
- [x] ✅ Checkpoint: why do real setups put a proxy in front instead of publishing every service's port?
- [x] 🔨 Mini break-it: `index.html` renamed to `home.html` → 403 Forbidden. Found via `docker logs` (`directory index ... is forbidden`) + `ls`; fixed with `mv`.

## Step 2 — Nginx in front of the api (`/api` → NestJS) ✔
- Concept: `nginx` service in compose with my own `nginx.conf` (mounted read-only), `location /api/ { proxy_pass http://api:3000/; }`. Service names = DNS names on the compose network. The api stops publishing 3000 (only Nginx is public).
- 🤔 Predict: `curl localhost/api/users` → which path does the api actually receive: `/api/users` or `/users`? Why?
- Commands: `docker compose up -d`, `docker compose exec nginx nginx -t`, `nginx -s reload`, `docker compose logs nginx api`, `curl -i`.
- [x] ✅ Checkpoint: why can Nginx reach `api:3000` while my PC can't anymore?
- [x] 🔨 Mini break-it: api stopped → 502 Bad Gateway. Found + fixed (started api). 502 = Nginx (the gateway) is fine but got no answer from the service behind it; 500 = the app itself got the request and failed; 404 = path not found.

## Step 3 — A second service: the frontend (`/` → web) ✔
- Concept: a tiny static frontend (written by Claude) in its own `web` container; it calls `/api/users` with `fetch`. Same origin through the proxy → no CORS problem.
- 🤔 Predict: the page is at `localhost/` and calls `/api/users`. If the api were still on `localhost:3000` instead, what would the browser complain about?
- Commands: add `web` service, `location / { proxy_pass http://web:80; }`, browser + DevTools Network tab, `curl`.
- [x] ✅ Checkpoint: Done when #1. Why: what does "single entry point" buy us (ports, CORS, TLS later)?
- [x] 🔨 Mini break-it: `web` disconnected from the compose network (`docker network disconnect`) → `/` 502 after ~15 s, `/api` fine, ps all Up. stop/start kept the break and nginx then crashed (`host not found in upstream "web"`). Found via `inspect .NetworkSettings.Networks` (empty). Fixed by recreating web (`up -d`).

## Step 4 — Proxy headers + logs ✔
- Concept: the api only sees Nginx as its client. `X-Forwarded-For` / `X-Real-IP` / `Host` pass on the real client info. Access log vs error log. Timeouts.
- 🤔 Predict: the api logs the client IP. Before adding headers, whose IP will it log?
- Commands: `proxy_set_header ...`, `docker compose logs -f nginx`, a small endpoint (Claude) that echoes headers.
- [x] ✅ Checkpoint: why would the api need the real client IP (rate limits, logs, security)?
- [x] 🔨 Mini break-it: api `docker pause`d → page loads, `/api` hangs ~60 s → 504. Found via `start api` error ("cannot start a paused container"), fixed with `unpause`. Mistake (R52): didn't know 504 vs 502 or paused vs stopped.

## Step 5 — Load balancing: 2 api copies ✔
- Concept: `docker compose up -d --scale api=2` (or `deploy.replicas`), `upstream api_backend { server api:3000; }`, round robin. Why `container_name` / published ports break scaling. Nginx resolves DNS at start (gotcha).
- 🤔 Predict: two api copies, both want host port 3000 published. What happens on `--scale api=2`?
- Commands: `--scale`, `curl` several times (Claude adds the hostname to a response), `docker compose ps`, `docker compose stop` one copy.
- [x] ✅ Checkpoint: Done when #2 part 1. Why: what does a second copy give us besides speed (one dies → ?) → high availability: api-1 stopped → all 200 from api-2 (nginx retries on next upstream, skips the dead one for `fail_timeout`). Also rolling updates.
- [x] 🔨 Mini break-it 5a: api-2 `docker pause`d → every 2nd `/api` request took 60 s, then 200. Found the pause, `unpause`. Why 200: paused = still has IP, port accepts the connection → nginx waits `proxy_read_timeout` (60 s) → timeout → `proxy_next_upstream` retries the SAME request on api-1 internally (not a redirect) → 200. Every 2nd = round robin lands on api-2 every other time.
- [x] 🔨 Mini break-it 5b: `up -d --scale api=1` → api-2 REMOVED (not in `ps -a`), `servedBy` always the same + an occasional ~3 s request. Found via `ps -a`, fixed with `up -d --scale api=2` (new api-2 got the same free IP by luck → no nginx reload needed; otherwise R50). 3 s = nobody at the old IP → ARP gets no reply → `No route to host` → nginx retries on api-1; it marks the server down for `fail_timeout` 10 s, then tries again. vs paused = connection accepted, no answer → 60 s read timeout.

## Step 6 — Redis caching ✔
- Concept: Redis = in-memory key/value store. Cache-aside: check Redis → miss → DB → save with a TTL. Claude writes the Nest part; Redis service in compose (no published port in prod).
- 🤔 Predict: you add a new user right after `GET /api/users` was cached. What does the next `GET` show, and why?
- Commands: `redis` service, `docker compose exec redis redis-cli` (`KEYS *`, `TTL`, `MONITOR`), `curl -i` (cache header), timing.
- [x] ✅ Checkpoint: Done when #2 part 2. Why: when is a cache worth it, and what is the price (stale data, invalidation)?
- [x] 🔨 Mini break-it: redis `CONFIG SET maxmemory 1` → every `/api/users` 200 but always `X-Cache: MISS`, no api errors. Found by a manual `SET` in redis-cli → `OOM command not allowed`, `CONFIG GET maxmemory` = 1. Fixed (maxmemory 0 / restart).

## Step 7 — Dev + prod with the proxy ✔
- Concept: Nginx in the base file; dev still hot-reloads THROUGH Nginx; prod publishes only 80. Check with `docker compose config` + `ps`.
- 🤔 Predict: in dev you save a file while Nginx is in front. Does the reload still show up at `localhost/api/...`? Why?
- [x] ✅ Checkpoint: list what is published in dev vs prod and why.
- [x] 🔨 Mini break-it: compose nginx stopped + a plain `docker run -p 80:80 nginx:alpine` "imposter" → `/` = "Welcome to nginx!", `/api/users` 404. Found via `compose ps -a` (nginx exited) + `docker ps` (imposter not in compose = no compose labels). Fixed: stop/rm imposter, start our nginx. A STOPPED container releases its host port; while one RUNS, a second one on that port → `port is already allocated`.

## Step 8 — Break it ✔
- Claude breaks things from `ROADMAP.md`: 502 Bad Gateway (wrong upstream name/port), a missing trailing slash in `proxy_pass`, Redis down. Only the symptom is given.
- Loop: symptom → look (`logs nginx`, `ps -a`, `exec nginx nginx -t`, `curl -i`) → guess → test → fix → explain. No hints for the first few minutes.
- [x] ✅ Checkpoint: each one fixed and explained in your own words.

## Step 9 — Explain-it run ✔
- Walk through `nginx.conf` and the compose files: for each part say WHAT it does, WHY it's there, WHAT breaks without it. Plus 2–3 "what would you reach for when X?" questions. Lookups are fine.
- [x] ✅ Checkpoint: every part explained; only wrong ideas / unknown features → `REVIEW.md`.

## Step 10 — Cleanup + cheat sheet ✔
- `docker compose down`, `docker image prune`. `CHEATSHEET.md` as questions; I answer, Claude puts 💡 suggestions in the file.
- [x] ✅ Checkpoint: "Done when" boxes ticked, Summary written.

---

## Notes / lessons learned
### Step 0
- Q1 (orphans, correct): compose only manages the services in the CURRENT files; a renamed/removed service's old container is left running = orphan. Remove with `up -d --remove-orphans` (compose also warns "Found orphan containers").
- Q2 (R19, didn't know): `down -v` deleted the `pgdata` volume = the whole DB. A network problem only needs `down` + `up` (or `up -d --force-recreate api`); `-v` only when I WANT the data gone.
- Q3 (R20 family, didn't know): a container lives exactly as long as PID 1. nginx by default forks into the background and the starter exits → PID 1 gone → container stops at once. `daemon off;` keeps nginx in the foreground as PID 1 (logs to stdout, gets SIGTERM from `docker stop`).
### Step 1
- Predict ✓: default page = `/usr/share/nginx/html/index.html`.
- Mistake (R21): `docker exec c cd /usr/share/nginx/html ls` → `cd` not found. exec runs a PROGRAM directly, no shell; `cd` is a shell builtin (and `cd` + `ls` aren't chained). Use `exec c ls /path` or `exec c sh -c 'cd /path && ls'`.
- `location /` + `root` = which folder a path maps to, `index` = file served for a folder; `error_page 500 502 503 504 /50x.html` = friendly error page.
- Checkpoint (partly): one entry point = no ports in the URL. Also: fewer open ports (api/db/pgAdmin hidden, smaller attack surface), one place for TLS/HTTPS, same origin = no CORS, can spread load over copies.
- Mistake (R47): didn't know why 403 and not 404 → folder exists, no index file, `autoindex` off → 403. Browser cache hid the break at first → test with `curl -i`. Listed the folder from memory instead of re-running `ls`.
### Step 2
- Predict ✓: trailing `/` in `proxy_pass http://api:3000/;` replaces `/api/` with `/` → api gets `/users`. Proxy ≠ redirect (redirect = 3xx, browser makes a new request; proxy forwards internally).
- Mistakes (R23): mount typo `default.confg` (nginx only includes `*.conf`); `service_healthy` but dev stage has no healthcheck; `depends_on: api` as a string → must be a list.
- Result: `curl localhost/api/users` ✓ through Nginx; `localhost:3000` refused (not published). Nginx and api share the compose network → `api:3000` by DNS; `ports:` only for reaching from OUTSIDE Docker. No port in URL = 80.
### Step 3
- Mistake (R48): Predict half right. Yes, the browser reaches published `localhost:3000` (the request runs on my PC, not in the container). But I thought same hostname = no CORS. Origin = scheme + host + port, so `localhost:80` ≠ `localhost:3000` → cross-origin. The browser sends the request but blocks the page's JS from reading the answer (CORS error in Console) unless the api allows that origin. Going through Nginx (`/api/`) = same origin = no CORS.
- Built: `web` = 2nd `nginx:alpine` serving `./web/index.html` (no ports), front nginx `location / { proxy_pass http://web:80/; }`. Page adds + lists users through `/api/users` ✓.
- Mistake (R49): after editing `default.conf`, `up -d` didn't recreate nginx (`Up 18 minutes`) → old config → `/` fell back to `/etc/nginx/html` → 404. Compose only recreates on a change to the service definition, not to mounted file contents. Apply with `nginx -s reload` / `restart nginx` / `--force-recreate`.
- Mistake (R50): said nginx crashed "because it depends on web". Real: nginx resolves `proxy_pass` names at startup, name not found = won't start; at runtime it keeps the cached IP (→ hang + 502). 502 = bad/no answer from upstream, 504 = upstream too slow.
### Step 4
- Predict ✓: without headers the api sees nginx's IP (socketIp 172.20.0.6), `Host: api:3000`. Added `proxy_set_header Host/X-Real-IP/X-Forwarded-For/X-Forwarded-Proto` → host `localhost`, xRealIp `172.20.0.1` = compose network gateway (Docker Desktop VM forwarding), not my PC; on a real server = visitor's public IP. `GET /api/whoami` (Claude) echoes it.
- Single-file mount: after an editor save the container still saw the OLD file (0 header lines inside vs 4 on disk) → `restart nginx`, not `-s reload`. Better: mount the folder. `nginx -t` before applying. `:ro` = only the container can't write (entrypoint's IPv6 script logs that, harmless).
- Mistake (R51): checkpoint "real IP for load balancing" → no, LB is in nginx; real reasons = logs/monitoring + security (rate limit, block, audit).
### Step 5
- Predict ✓: published `3000:3000` + `--scale api=2` → 2nd container fails (`port is already allocated`, a HOST port conflict, Docker refuses before Nest runs). Inside, each container has its own 3000. No `ports:` on api = scales fine.
- `--scale api=2` → api-1 + api-2; Docker DNS (`127.0.0.11`) returns BOTH IPs for `api` (`nslookup api`). But: nginx resolved `api` at startup (1 copy) → all to api-1 (R50 again). After restart still ~7:1, because 16 workers each have their own round-robin counter. Fix: `upstream api_backend { zone api_backend 64k; server api:3000; }` + `proxy_pass http://api_backend/;` → alternates 1-2-1-2 ✓.
- Single-file mount on Docker Desktop kept the OLD file size → container read a TRUNCATED config (`unexpected end of file`, also explains the earlier crash). Fix: mount folders (`./nginx:/etc/nginx/conf.d:ro`, `./web:/usr/share/nginx/html:ro`). Workflow now: edit → `nginx -t` → `nginx -s reload`.
- `--scale` is a CLI flag, not saved in YAML → plain `up -d` goes back to 1 copy (`deploy.replicas` to make it permanent).
### Step 6
- Predict ✓: cached list stays stale until TTL → invalidate (DEL key) on POST.
- Predict ✓ (2 copies): call #2 on api-2 = HIT, because the cache lives in the ONE shared redis container, not in each api's RAM (per-copy memory caches would miss + drift apart). Checked: MISS then HIT.
- Checkpoint ✓: worth it for data read MANY times, changing rarely, expensive to get (DB query, slow API). Price: stale data until TTL/invalidation; plus invalidation logic, one more service to run/monitor, cache memory.
- Break-it why: the app swallows the SET error (`.catch(() => undefined)`) and GET just returns nil → MISS → DB → still 200 (graceful degradation, but a silent catch hides the problem; better to log a warning). `CONFIG SET` is runtime-only (not in yaml/redis.conf), so `restart redis` also resets it to default 0 = no limit.
- Mistake (R44): `depends_on: redis: condition: service_completed_successfully` → that waits for an EXIT; redis never exits → api never starts. Servers: `service_started` / `service_healthy` (+ `redis-cli ping` healthcheck).
### Step 7
- Predict ✓: hot reload works through nginx; nest restarts INSIDE the same container (same IP) → nothing to reload in nginx (only its own config / a new upstream IP would need it). Wording: nginx proxies, not redirects. A request during the nest restart may get a 502.
- Gotcha (not my mistake): a save that REPLACES the file (new inode: some editors, `sed -i`, Claude's edit tool) → tsc's per-file watcher stayed on the old inode → that one file stopped reloading, others still worked. Fix: `tsconfig.json` `watchOptions.watchFile: useFsEventsOnParentDirectory` (watch the folder) + `restart api`. Other common fix in containers: polling.
- Both copies recompile on one save: each container bind-mounts the SAME host folder `./api:/app` and runs its OWN `nest --watch`.
- Checkpoint ✓ (`docker compose config | grep -A3 ports`): dev = 80 (nginx) + 5432 (postgres, for DB tools from my PC) + 5050 (pgAdmin); prod = only 80. Only nginx faces the outside; everything else is internal, reached by service name. Done when #1 "nothing else published in prod" ✓.
### Step 8
- Break #1: upstream `server api:3001` → `/` 200, `/api` instant 502. Found via `netstat -tln` in api (listens 3000) + conf. Fixed + `nginx -s reload`/restart (nginx reads config only at start/reload). Instant = container alive, nothing listening on 3001 → connection refused at once (vs paused: accepted, no answer → 60 s; vs removed: nobody at the IP → ~3 s).
- Break #2: `proxy_pass http://api_backend;` (no trailing `/`) → `/api/*` 404 `Cannot GET /api/users`. Found the missing `/`. Mistake (R53): first unsure which way to fix; with `/` nginx replaces `/api/` → `/users`, without it the original `/api/users` goes through.
  - The 404 came from Nest: JSON `Cannot GET ...` (nginx's own 404 = HTML page "404 Not Found / nginx"). Rule: no path after the host in proxy_pass = URL unchanged; ANY path (even just `/`) = matched location text replaced with it.
- Break #3: `compose stop redis` → `/api/users` 200 but 1–8 s, always MISS. Found via `logs redis` (SIGTERM, "User requested shutdown" = stopped, not crashed). Fixed with start. 200 = try/catch → DB fallback (graceful degradation); slow = ioredis reconnect attempts per request; vs maxmemory: connected + instant OOM error (silent catch) → fast MISS.
### Step 9
- default.conf ✓: `listen 80` (default http port, no port in URL), `location /` → web (catches everything not matched by a longer prefix), `location /api/` → upstream (longest prefix wins), `upstream` = group nginx load-balances (round robin), `proxy_set_header` = real client info for the api.
- Mistake (R54): forgot what `zone` does → shared upstream state for all workers (without it: ~7:1).
- Q: why a separate `web` nginx? Could serve `index.html` from the main nginx (`root`); separate service = like a real frontend app (own deploys/scaling) + practice routing. SPA fallback = `try_files $uri $uri/ /index.html;` in the nginx that serves the files.
- Tried `try_files` in the FRONT nginx (instead of proxy_pass) → 500 `rewrite or internal redirection cycle`: that nginx has no files, so fallback `/index.html` → matches `location /` again → loop. Fix (Claude): front nginx back to `proxy_pass`; `web` got its own `web-nginx/default.conf` (root + try_files), mounted to `/etc/nginx/conf.d`. Now `/about` → index.html 200. Downside: missing assets (`/nope.png`) also get index.html.
- Workers: nginx = 1 master + N worker processes (`worker_processes auto` = 1 per CPU core = 16 here), each handles connections on its own → `zone` to share upstream state.
- Compose walkthrough ✓ mostly: healthchecks, depends_on conditions (migrate = completed_successfully), migrate = same image + other command, ro mounts, web SPA. Own insight: depends_on only counts at STARTUP; a DB dying later isn't handled. Mistakes: R55 (why named pgdata volume), R56 (CA secret = trust the proxy, not avoid it). Dev/prod = also bind mount + watch vs dist + restart.
- Reach-for questions: Q1 ❌ (R57) per-request copy + duration → nginx access log `log_format` with `$upstream_addr`, `$request_time`. Q2 ✓ HTTPS → nginx: cert + key (Let's Encrypt), `listen 443 ssl`, 80 → 443 redirect. Q3 ✓ (meant: api healthcheck that checks the pg connection) → `/health` (`SELECT 1`) → `unhealthy`; compose only marks it, no auto-restart (that's K8s).
- Anonymous volume tested: `down` + `up` = NEW anonymous volume, data gone (old one orphaned). Plain `up -d` recreate (no down) carries it over. See running mounts: `docker ps --format 'table {{.Names}}\t{{.Mounts}}'`.
### Step 10
- Cheat sheet: review answers R25, R26, R48, R52, R54 ✓ (streak +1). Needed answers: 403 vs 404, trailing-slash path, who produced the 404, removed-container timing, `up -d` vs mounted config, nginx DNS at startup, access log fields, real-IP reasons, per-copy cache, fast vs slow MISS, `cd` in exec, YAML indent. New rows R58–R60.
- Cleanup: `docker compose down` (pgdata volume kept), `docker image prune` (nothing dangling).

---

## Summary
- One entry point: front `nginx` is the only published service in prod (port 80). `location /` → `web` (2nd nginx serving the page, SPA fallback with `try_files` in ITS config), `location /api/` → `upstream api_backend`. Same origin = no CORS; api/db/redis only reachable by service name inside the compose network.
- `proxy_pass` rules: a URI after the host (even `/`) REPLACES the matched location text; no URI = path passed unchanged. 404 body tells who answered (JSON = Nest, HTML = nginx).
- Proxy headers (`Host`, `X-Real-IP`, `X-Forwarded-For`, `-Proto`) so the api sees the real client (logs, rate limiting, security).
- Load balancing: `--scale api=2` (no `ports:` on api), Docker DNS returns both IPs, `upstream` + `zone` for an even 1-2-1-2 across the 16 workers. Nginx resolves names at START → reload after scaling.
- Config workflow: mount the FOLDER, edit → `nginx -t` → `nginx -s reload`. `up -d` doesn't notice changed file contents; single-file mounts can go stale/truncated on Docker Desktop.
- Redis cache-aside: `GET /users` cached with TTL, `DEL` on every write; shared cache = all copies see the same data. Graceful degradation when Redis is down (slow MISS) vs refusing writes (fast MISS).
- Error codes: 502 = refused/unreachable (wrong port instantly, removed container ~3 s), 504 = connected but no answer (paused, 60 s `proxy_read_timeout`), 500 internal redirection cycle = `try_files` in a nginx with no files.
- Weak spots (REVIEW.md R47–R60): 403 vs 404, origin includes port, mounted config vs `up -d`, nginx DNS at startup, trailing slash, `zone`, access log fields, named pgdata volume, CA secret = trust, cache drift.
- Next topic suggestion: CI/CD with GitHub Actions (project 7): on every push, lint + test + build the api image, run the compose stack in CI and `curl` through nginx as a smoke test, push the image to a registry. Good place to revisit R25 (RUN vs CMD), R26 (healthcheck target, use it to wait in CI) and R56 (secrets: CI secrets instead of baked-in values).
