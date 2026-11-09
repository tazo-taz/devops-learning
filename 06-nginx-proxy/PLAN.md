# Project 6 — Nginx reverse proxy + multiple services

**Goal:** Put Nginx in front of everything: `/api` goes to NestJS, `/` goes to a small frontend. Run 2 copies of the api behind Nginx and add Redis for caching.
**You learn:** reverse proxies, routing, load balancing (2 copies of the API), and caching.
**Done when:**
- [ ] everything is reachable through a single port 80 (frontend at `/`, api at `/api/...`), and nothing else is published in prod
- [ ] (extra) 2 api copies answer in turn, and `GET /api/users` is served from Redis on the second call

> From project 5: dev stage + bind mount hot reload, base + dev/prod compose overrides (`COMPOSE_FILE` in `.env`), one-shot `migrate` service, pgAdmin in dev.
> Problem now: the api is published directly on port 3000. Real sites have ONE entry point (80/443) that routes to many services, can spread load over several copies, and caches.
> Starting code = a copy of `05-dev-vs-prod/` (without `node_modules`/`dist`/`uploads`, `.env` copied, still git-ignored). New folder = new compose project = new empty volume `06-nginx-proxy_pgdata`.
> Method: Explain-it, not memorize. Looking up syntax (nginx config!) is fine; what matters is knowing WHAT exists and WHY.

Every step ends with 🔨 mini break-it(s): Claude quietly breaks one thing and gives only the symptom. Keep the files closed until you've looked with `ps` / `logs` / `inspect` / `exec`.

---

## Step 0 — Warm-up (no notes)
- 3 recall questions in chat: 1 from project 5, 2 open `REVIEW.md` items. Update streaks.

## Step 1 — What a reverse proxy is (Nginx alone)
- Concept: a reverse proxy = one front door; the client only talks to Nginx, Nginx forwards to services on the internal network and passes the answer back. vs. a normal (forward) proxy, which sits on the client's side (like the corporate proxy).
- 🤔 Predict: you run `nginx:alpine` with `-p 8080:80` and open `localhost:8080`. What do you see, and where does that page live inside the container?
- Commands: `docker run --rm -d -p 8080:80 nginx:alpine`, `curl`, `exec ... cat /etc/nginx/conf.d/default.conf`, `nginx -t`, `docker logs` (access log).
- ✅ Checkpoint: why do real setups put a proxy in front instead of publishing every service's port?
- 🔨 Mini break-it:

## Step 2 — Nginx in front of the api (`/api` → NestJS)
- Concept: `nginx` service in compose with my own `nginx.conf` (mounted read-only), `location /api/ { proxy_pass http://api:3000/; }`. Service names = DNS names on the compose network. The api stops publishing 3000 (only Nginx is public).
- 🤔 Predict: `curl localhost/api/users` → which path does the api actually receive: `/api/users` or `/users`? Why?
- Commands: `docker compose up -d`, `docker compose exec nginx nginx -t`, `nginx -s reload`, `docker compose logs nginx api`, `curl -i`.
- ✅ Checkpoint: why can Nginx reach `api:3000` while my PC can't anymore?
- 🔨 Mini break-it:

## Step 3 — A second service: the frontend (`/` → web)
- Concept: a tiny static frontend (written by Claude) in its own `web` container; it calls `/api/users` with `fetch`. Same origin through the proxy → no CORS problem.
- 🤔 Predict: the page is at `localhost/` and calls `/api/users`. If the api were still on `localhost:3000` instead, what would the browser complain about?
- Commands: add `web` service, `location / { proxy_pass http://web:80; }`, browser + DevTools Network tab, `curl`.
- ✅ Checkpoint: Done when #1. Why: what does "single entry point" buy us (ports, CORS, TLS later)?
- 🔨 Mini break-it:

## Step 4 — Proxy headers + logs
- Concept: the api only sees Nginx as its client. `X-Forwarded-For` / `X-Real-IP` / `Host` pass on the real client info. Access log vs error log. Timeouts.
- 🤔 Predict: the api logs the client IP. Before adding headers, whose IP will it log?
- Commands: `proxy_set_header ...`, `docker compose logs -f nginx`, a small endpoint (Claude) that echoes headers.
- ✅ Checkpoint: why would the api need the real client IP (rate limits, logs, security)?
- 🔨 Mini break-it:

## Step 5 — Load balancing: 2 api copies
- Concept: `docker compose up -d --scale api=2` (or `deploy.replicas`), `upstream api_backend { server api:3000; }`, round robin. Why `container_name` / published ports break scaling. Nginx resolves DNS at start (gotcha).
- 🤔 Predict: two api copies, both want host port 3000 published. What happens on `--scale api=2`?
- Commands: `--scale`, `curl` several times (Claude adds the hostname to a response), `docker compose ps`, `docker compose stop` one copy.
- ✅ Checkpoint: Done when #2 part 1. Why: what does a second copy give us besides speed (one dies → ?)
- 🔨 Mini break-it ×2:

## Step 6 — Redis caching
- Concept: Redis = in-memory key/value store. Cache-aside: check Redis → miss → DB → save with a TTL. Claude writes the Nest part; Redis service in compose (no published port in prod).
- 🤔 Predict: you add a new user right after `GET /api/users` was cached. What does the next `GET` show, and why?
- Commands: `redis` service, `docker compose exec redis redis-cli` (`KEYS *`, `TTL`, `MONITOR`), `curl -i` (cache header), timing.
- ✅ Checkpoint: Done when #2 part 2. Why: when is a cache worth it, and what is the price (stale data, invalidation)?
- 🔨 Mini break-it:

## Step 7 — Dev + prod with the proxy
- Concept: Nginx in the base file; dev still hot-reloads THROUGH Nginx; prod publishes only 80. Check with `docker compose config` + `ps`.
- 🤔 Predict: in dev you save a file while Nginx is in front. Does the reload still show up at `localhost/api/...`? Why?
- ✅ Checkpoint: list what is published in dev vs prod and why.
- 🔨 Mini break-it:

## Step 8 — Break it
- Claude breaks things from `ROADMAP.md`: 502 Bad Gateway (wrong upstream name/port), a missing trailing slash in `proxy_pass`, Redis down. Only the symptom is given.
- Loop: symptom → look (`logs nginx`, `ps -a`, `exec nginx nginx -t`, `curl -i`) → guess → test → fix → explain. No hints for the first few minutes.
- ✅ Checkpoint: each one fixed and explained in your own words.

## Step 9 — Explain-it run
- Walk through `nginx.conf` and the compose files: for each part say WHAT it does, WHY it's there, WHAT breaks without it. Plus 2–3 "what would you reach for when X?" questions. Lookups are fine.
- ✅ Checkpoint: every part explained; only wrong ideas / unknown features → `REVIEW.md`.

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
