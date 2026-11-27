# Project 9 — Monitoring and logging

**Goal:** Add Prometheus (metrics), Grafana (dashboards), and Loki (logs). Expose metrics from NestJS, and add exporters for Postgres and the server itself. Set up an alert, for example "API is down", sent to Telegram.
**You learn:** observability, which is a skill interviewers love to ask about.
**Done when:**
- [ ] a Grafana dashboard shows requests per second, errors, CPU, and DB connections
- [ ] the api's container logs are searchable in Grafana (Loki)
- [ ] stopping the api sends an "API is down" message to Telegram, and a "resolved" one when it's back

> From project 8: the stack runs on a server with HTTPS, CI deploys it, backups run from cron. But every problem so far was found BY HAND: `docker compose logs`, `ps`, `df -h`, after someone noticed the site was down.
> Problem now: the system should tell US first. What is it doing right now (metrics), what did it say (logs), and who gets woken up (alerts)?
> Starting code = a copy of `08-deploy-vps/` (without `node_modules`/`dist`/docs, `.env` copied, still git-ignored).
> Where it runs: on my PC with Docker Compose (the dev stack + a new `docker-compose.monitoring.yaml`). No VPS needed; the same files would work on one. The local VM `vps` from project 8 is not needed (decide: delete it, or keep it as a second "server" to monitor).
> Three pillars: **metrics** = numbers over time (cheap, good for dashboards + alerts), **logs** = text events (good for "what exactly happened"), **traces** = one request's path through services (not in this project; good to know it exists).
> Tools: Prometheus PULLS metrics (it calls `/metrics` on every target every few seconds). Grafana only DRAWS; it stores nothing itself. Loki stores logs; an agent (Grafana Alloy; Promtail is retired) reads the container logs and pushes them to Loki. Alertmanager sends the alerts Prometheus fires.
> ⚠️ Corporate proxy: Alertmanager must reach `api.telegram.org` through the proxy (`proxy_url`), and may need the MIA CA.
> Claude writes the Nest code and new config files; I explain them and run the infra commands.
> Method: Explain-it, not memorize. Quiz labels: 🧪 = made-up scenario · 📄 = about our real files (file:line given).

Every step ends with 🔨 mini break-it(s): Claude quietly breaks one thing and gives only the symptom. Keep the files closed until you've looked (Prometheus `/targets`, Grafana Explore, `docker compose ps/logs`, `curl`).

---

## Step 0 — Warm-up (no notes) ✔
- 3 recall questions in chat: 2 from project 8, 1 open `REVIEW.md` item. Update streaks.

## Step 1 — A `/metrics` endpoint in the api
- Concept: the app counts things itself and shows them as plain text at `/metrics` (Prometheus format). Types: **counter** (only goes up: requests, errors), **gauge** (up and down: memory, open connections), **histogram** (how long things took, in buckets). Labels split one metric (`method`, `route`, `status`). `prom-client` also gives default Node metrics (CPU, memory, event loop).
- 🤔 Predict: `http_requests_total` is a counter and shows 5000. The api restarts. What does it show now, and is that a problem for a "requests per second" graph?
- Claude adds `prom-client`, a metrics module (request counter + duration histogram) and `GET /metrics`. I `curl` it and read the output.
- [ ] ✅ Checkpoint: `curl localhost/api/metrics` (or the api port) shows `http_requests_total` growing after a few requests. Why: why a counter + `rate()` instead of the app calculating "requests per second" itself?
- 🔨 Mini break-it:

## Step 2 — Prometheus scrapes it
- Concept: `prometheus.yml` = a list of jobs/targets + `scrape_interval`. Prometheus calls each target, stores the numbers with a timestamp (a time series). Its UI: **Status → Targets** (UP/DOWN + last error), and a query box for **PromQL**. `up` = 1/0 per target, made by Prometheus itself.
- 🤔 Predict: we run 2 api copies behind nginx. If Prometheus scrapes `http://nginx/api/metrics`, what is wrong with the numbers it gets?
- New `docker-compose.monitoring.yaml` with `prometheus` + `prometheus/prometheus.yml`, open the UI, look at Targets, try `up`, `http_requests_total`, `rate(http_requests_total[1m])`.
- [ ] ✅ Checkpoint: the api target is UP and `rate(...)` shows traffic I create with a `curl` loop. Why: pull instead of push, what does Prometheus learn for free from a failed scrape?
- 🔨 Mini break-it:

## Step 3 — Exporters: Postgres and the host
- Concept: Postgres and Linux don't speak Prometheus. An **exporter** = a small program next to them that translates: `postgres-exporter` (connections, DB size, locks), `node-exporter` (CPU, RAM, disk, network of the HOST; needs host `/proc` + `/sys` mounted). Each is one more scrape target. (cAdvisor = per-container numbers; good to know.)
- 🤔 Predict: node-exporter runs in a container. Without any mounts, WHOSE CPU and disk does it report?
- Add both exporters + scrape jobs, a read-only monitoring user for Postgres, find `pg_stat_activity_count` and `node_filesystem_avail_bytes`.
- [ ] ✅ Checkpoint: 3+ targets UP; I can show DB connections and free disk in PromQL. Why: why a separate DB user for the exporter?
- 🔨 Mini break-it:
- 🔨 Mini break-it:

## Step 4 — Grafana dashboard
- Concept: Grafana = a UI over data sources (Prometheus now, Loki later). Dashboard = panels, each panel = one query. Provisioning = data sources + dashboards as FILES in git (not clicked together and lost with the volume). The four numbers to watch: rate, errors, duration (RED) + resources.
- 🤔 Predict: the Grafana container is deleted and recreated. Which of these survive: a dashboard clicked in the UI, a provisioned one, the metrics themselves?
- Add `grafana` with a provisioned Prometheus data source, build panels: requests/s, error % (5xx), p95 duration, CPU, memory, DB connections. Export the dashboard JSON into the repo.
- [ ] ✅ Checkpoint: the dashboard shows all four "Done when" numbers and reacts to a `curl` loop. Why: why p95 and not the average?
- 🔨 Mini break-it:

## Step 5 — Logs with Loki
- Concept: so far logs = `docker compose logs` on ONE machine, gone with the container. Alloy (the agent) reads every container's stdout via the Docker socket, adds labels (`service`, `container`), pushes to Loki. Loki indexes only the LABELS, not the text → cheap. Query language LogQL: `{service="api"} |= "error"`. Apps should log to stdout, ideally JSON (one event per line).
- 🤔 Predict: the api logs to a file inside its container instead of stdout. What does Loki see?
- Add `loki` + `alloy` + configs, Loki data source in Grafana, Explore: all api logs, only errors, logs next to the metrics graph for the same time range.
- [ ] ✅ Checkpoint: I trigger a 500 and find its log line in Grafana by label + text. Why: why few labels (service) and NOT a label per user id?
- 🔨 Mini break-it:

## Step 6 — Alert to Telegram
- Concept: an alert rule = a PromQL expression + `for:` (how long it must be true, to skip blips). Prometheus only FIRES alerts; **Alertmanager** groups them, stops repeats, and sends them (Telegram, Slack, email). States: inactive → pending → firing → resolved. Alert on symptoms users feel (down, error rate, disk almost full), not on every number.
- 🤔 Predict: the rule is `up{job="api"} == 0` with `for: 1m`, scrape every 15s. I stop the api for 30 seconds. Does Telegram get a message?
- Telegram bot (BotFather) + chat id, `alertmanager` + config (token from a file, never in git; proxy), rules file: ApiDown, HighErrorRate, DiskAlmostFull. Stop the api and wait.
- [ ] ✅ Checkpoint: "API is down" arrives in Telegram, and "resolved" after the api is back. Why: what is `for:` protecting me from, and what does it cost?
- 🔨 Mini break-it:
- 🔨 Mini break-it:

## Step 7 — Keep it private + CI
- Concept: `/metrics`, Prometheus and Grafana show internals (routes, versions, load) and Prometheus has no login → never public (R37, R85). nginx blocks `/api/metrics` from outside, monitoring ports bound to `127.0.0.1` or not published, Grafana admin password from `.env`. Retention (`--storage.tsdb.retention.time`) so the disk doesn't fill up (project 8, disk full). Monitoring the monitoring: who tells me Prometheus is down?
- 🤔 Predict: Prometheus itself dies at night. Which of my alerts fires?
- Lock it down, set retention, point `ci.yml` at `09-monitoring/` (tests + build + smoke still green; the monitoring stack is not part of the smoke test).
- [ ] ✅ Checkpoint: from outside `/api/metrics` is refused, Prometheus still scrapes it inside, CI is green on `09-monitoring/`. Why: why can Prometheus still reach `/metrics` when nginx blocks it?
- 🔨 Mini break-it:

## Step 8 — Break it
- Claude breaks things one at a time, gives only the symptom (from ROADMAP): a target shows DOWN in Prometheus, a dashboard with no data, an alert that never fires.
- Loop: symptom → look (Targets page + last error, Grafana query inspector, Prometheus Alerts page, Alertmanager UI + logs) → guess → test → fix → explain.
- [ ] ✅ Checkpoint: all three found and explained.

## Step 9 — Explain-it run
- Walk through the whole path: api counts → `/metrics` → Prometheus scrape → PromQL → Grafana panel; container stdout → Alloy → Loki → Explore; rule → pending → firing → Alertmanager → Telegram. For each part say WHAT it does, WHY it's there, WHAT breaks without it. Plus 2–3 "what would you reach for when X?" questions. Lookups are fine.
- [ ] ✅ Checkpoint: every part explained; only wrong ideas / unknown features → `REVIEW.md`.

## Step 10 — Cleanup + cheat sheet
- Stop the stack, remove volumes I don't need, revoke the Telegram bot token if unused. `CHEATSHEET.md` as questions; I answer, Claude puts 💡 suggestions in the file.
- [ ] ✅ Checkpoint: "Done when" boxes ticked, Summary written, ROADMAP row updated.

---

## Notes / lessons learned
### Step 0
- Mistake: Q1 (R85 ✗): said Grafana on `3000:3000` is safe because ufw doesn't allow 3000. A published Docker port skips ufw (Docker's own iptables rules come first) → reachable. No `ports:` or `127.0.0.1:3000:3000`.
- Q2 (R93, half): recreate ✓ (`up -d` alone is enough, no `down`), and good catch that a volume can keep the old password (Grafana stores the admin password in its DB at FIRST start, like Postgres). Missing: `restart` = the SAME container, its env was fixed at creation.
- Mistake: Q3 (R28 ✗): `exec node-exporter bash` → Alpine has no bash, use `sh`. Also `apk` not `apt`, musl not glibc, no curl by default.
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
