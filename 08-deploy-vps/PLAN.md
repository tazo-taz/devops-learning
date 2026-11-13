# Project 8 — Deploy to a real server

**Goal:** Rent a cheap VPS, install Docker, and run the stack there with Compose. Extend the pipeline so it SSHes in and deploys automatically. Add HTTPS with Let's Encrypt, plus automatic daily Postgres backups with `pg_dump` and cron.
**You learn:** Linux servers, SSH, firewalls, domains and SSL, backups, and zero-touch deployment.
**Done when:**
- [ ] pushing to main updates the live site at `https://<your domain>` with no manual step
- [ ] the server only accepts SSH with a key (no passwords, no root login) and the firewall only lets in 22, 80, 443
- [ ] a daily `pg_dump` backup exists, and you restored one into an EMPTY database and saw the users come back

> From project 7: CI tests → builds → pushes `ghcr.io/tazo-taz/devops-api:<sha>` → smoke-tests the whole stack with that image. But the image only lands in a registry; nobody runs it anywhere for real.
> Problem now: "deployed" = running on a machine on the internet, with a real name, HTTPS, a firewall, and data that survives a disaster.
> Starting code = a copy of `07-ci-cd/` (without `node_modules`/`dist`/`uploads`, `.env` copied, still git-ignored). The CI workflow will be pointed at `08-deploy-vps/`.
> Decisions (2026-11-13): rent a VPS (Hetzner / DigitalOcean, ~€4–6/month; **delete it at the end if you don't keep it**), and use your own domain (bought or already owned).
> HTTPS choice: Certbot + our existing nginx (you see the HTTP-01 challenge, the cert files, renewal and reload). Caddy/Traefik do this automatically; good to know they exist.
> Same image everywhere (R46, R71): the server never BUILDS, it PULLS the image CI tested, by sha. So no `ca` secret, no source code needed on the server, only compose files + `.env`.
> ⚠️ My PC is behind a corporate proxy: outgoing SSH (port 22) may be blocked on that network. If `ssh` hangs, test from another network (phone hotspot) or use the provider's web console.
> Method: Explain-it, not memorize. Looking up commands is fine; what matters is knowing WHAT exists and WHY.
> Quiz labels: 🧪 = made-up scenario · 📄 = about our real files (file:line given).

Every step ends with 🔨 mini break-it(s): Claude quietly breaks one thing and gives only the symptom. Keep the files closed until you've looked (`ssh`, `ss -tlnp`, `ufw status`, `docker compose ps/logs`, `journalctl`).

---

## Step 0 — Warm-up (no notes)
- 3 recall questions in chat: 1 from project 7, 2 open `REVIEW.md` items. Update streaks.

## Step 1 — Rent the VPS + log in with an SSH key
- Concept: a VPS = a Linux VM in a data center with a public IP. SSH key pair: PRIVATE key stays on my PC (`~/.ssh/id_ed25519`), PUBLIC key goes on the server (`~/.ssh/authorized_keys`). The server proves you have the private key without it ever leaving your PC.
- 🤔 Predict: you accidentally upload your PRIVATE key to the server instead of the public one. What's the risk, and does login even work?
- `ssh-keygen -t ed25519`, create the VPS (Ubuntu 24.04, smallest size) with the public key added, `ssh root@<ip>`. Look around: `uname -a`, `df -h`, `free -h`, `ip a`.
- [ ] ✅ Checkpoint: logged in without a password. Why: what does the server store, and why is that safer than a password?
- 🔨 Mini break-it: (Claude picks)

## Step 2 — Harden the server: user, SSH, firewall
- Concept: never work as `root` → own user with `sudo`. `sshd_config`: `PermitRootLogin no`, `PasswordAuthentication no`. Firewall `ufw`: default deny incoming, allow 22/80/443. ⚠️ Docker publishes ports by writing its OWN iptables rules → a published port can bypass `ufw` (only publish what must be public).
- 🤔 Predict: you run `ufw enable` BEFORE `ufw allow 22`. What happens to your SSH session (now and next login)?
- `adduser`, `usermod -aG sudo`, copy the key, test the new login in a SECOND terminal before closing the first, edit `sshd_config`, `systemctl reload ssh`, `ufw`. Automatic security updates (`unattended-upgrades`).
- [ ] ✅ Checkpoint: `ssh root@<ip>` refused, `ssh <you>@<ip>` works, `ufw status` shows 22/80/443. Why: why test in a second terminal before logging out?
- 🔨 Mini break-it: (Claude picks)

## Step 3 — Docker on the server + pull our image
- Concept: install Docker Engine from Docker's apt repo, add the user to the `docker` group (⚠️ = root-equivalent: anyone in it can mount `/` into a container). GHCR package is private → server logs in with a PAT that can ONLY `read:packages` (least privilege).
- 🤔 Predict: the server runs `docker pull ghcr.io/tazo-taz/devops-api:<sha>` before `docker login`. What error do you get, and why not just use your full-access token?
- Install Docker, `docker login ghcr.io`, pull the newest main image by sha.
- [ ] ✅ Checkpoint: `docker images` on the server shows the exact sha CI pushed. Why: why does the server pull instead of building from the source?
- 🔨 Mini break-it: (Claude picks)

## Step 4 — Deploy by hand with Compose
- Concept: server needs only the compose files + nginx/web configs + `.env` (never in git; copied with `scp` or written on the server). A `docker-compose.server.yaml` override (Claude writes it, like `docker-compose.ci.yaml`): `image: ${API_IMAGE}`, `restart: unless-stopped`, only nginx publishes ports. `up -d --no-build`.
- 🤔 Predict: postgres has no `ports:` in our compose. Can someone on the internet reach the database? What would change if it had `ports: ["5432:5432"]` (remember the ufw/Docker note)?
- Copy files to `~/app`, write `.env` with a NEW strong password, start, `curl http://<ip>/api/users` from my PC.
- [ ] ✅ Checkpoint: the site works at `http://<ip>`, and it comes back after `sudo reboot`. Why: which setting brings the containers back after a reboot?
- 🔨 Mini break-it: (Claude picks)

## Step 5 — Domain + HTTPS (Let's Encrypt)
- Concept: DNS `A` record `yourdomain.com → <ip>` (+ `www`). Let's Encrypt HTTP-01 challenge: Certbot puts a token file under `/.well-known/acme-challenge/`, Let's Encrypt fetches it over port 80 → proves you control the domain → cert (90 days). nginx: port 80 = challenge + redirect to HTTPS, port 443 = `ssl_certificate` + the old routes. Renewal = cron/timer + nginx reload (R49: nginx reads files only at start/reload).
- 🤔 Predict: you request the cert, but the DNS record still points at an old IP (or hasn't spread yet). What does Let's Encrypt see, and what does Certbot report?
- DNS record, check with `dig +short yourdomain.com`, Certbot (webroot shared with nginx), nginx `listen 443 ssl`, redirect, renewal dry run.
- [ ] ✅ Checkpoint: `https://yourdomain.com` has a valid lock, `http://` redirects, `certbot renew --dry-run` passes. Why: why does HTTPS still need port 80 open?
- 🔨 Mini break-it: (Claude picks)

## Step 6 — Zero-touch deploy from CI (SSH)
- Concept: new `deploy` job (`needs: smoke`, only main): SSH key for CI = a SEPARATE key pair (private part in a GitHub secret `SSH_KEY`, public part on the server), plus `SSH_HOST`, `known_hosts` (so CI can't be tricked into a fake server). On the server: `export API_IMAGE=...:<sha>; docker compose pull && docker compose up -d --no-build`. GitHub `environment: production` (R73) holds these secrets.
- 🤔 Predict: why give CI its own key instead of copying your personal private key into the secret? What do you do if the CI key leaks?
- Point `ci.yml` at `08-deploy-vps/`, add the deploy job, push a visible change (e.g. text in `web/index.html`) → watch it go live.
- [ ] ✅ Checkpoint: a push to main changes the live site with no manual step, and the running container's image = that commit's sha. Why: how do you roll back if the new version is broken?
- 🔨 Mini break-it: (Claude picks)

## Step 7 — Daily Postgres backups + restore
- Concept: `pg_dump` = a SQL snapshot of one DB (consistent, while it runs). Run it via `docker compose exec -T postgres pg_dump ...`, gzip, filename with the date, keep the last 7 (rotation), `cron` daily. A backup on the SAME server dies with the server → copy off-server (mention: object storage / my PC with `scp`). A backup you never restored = not a backup.
- 🤔 Predict: you `down -v` (R19), then `up -d`. The migrate job runs again on the empty DB. Then you restore the dump. What could conflict, and in which order would you do it?
- Script `backup.sh`, crontab line, check the log/output next day (or trigger by hand), restore into an EMPTY database and count the users.
- [ ] ✅ Checkpoint: a dated `.sql.gz` exists, and after a restore into an empty DB the users are back. Why: why test the restore, not just the backup?
- 🔨 Mini break-it: (Claude picks)

## Step 8 — Break it
- Claude breaks things one at a time, gives only the symptom (from ROADMAP): firewall blocks port 443, the SSH key is missing in CI, the disk is full. (Restore into an empty DB is practiced in Step 7.)
- Loop: symptom → look (`curl -v`, `ufw status`, Actions log, `df -h`, `docker system df`, `journalctl`) → guess → test → fix → explain.
- [ ] ✅ Checkpoint: all three found and explained.

## Step 9 — Explain-it run
- Walk through the whole path: DNS → firewall → nginx 80/443 → api/web → postgres; CI → GHCR → SSH → `compose pull/up`; cron → `pg_dump`. For each part say WHAT it does, WHY it's there, WHAT breaks without it. Plus 2–3 "what would you reach for when X?" questions. Lookups are fine.
- [ ] ✅ Checkpoint: every part explained; only wrong ideas / unknown features → `REVIEW.md`.

## Step 10 — Cleanup + cheat sheet
- Decide: keep the VPS (projects 9–10 can use it) or delete it (stops the bill). Revoke unused tokens/keys. `CHEATSHEET.md` as questions; I answer, Claude puts 💡 suggestions in the file.
- [ ] ✅ Checkpoint: "Done when" boxes ticked, Summary written, ROADMAP row updated.

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
