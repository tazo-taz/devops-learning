# Project 08, explained simply

What we did so far, why we did it, and what problem each step solves.
(Written 2026-11-16, after Step 3. Steps 4–11 are still to come.)

---

## The big picture: what is this project about?

Up to project 7, our app only ever ran **on your own PC**:

- Projects 2–6: we built the app (NestJS API + Postgres + nginx + web + Redis) and ran it with `docker compose`.
- Project 7: GitHub Actions tests the app, builds a Docker image and stores it in GHCR (`ghcr.io/tazo-taz/devops-api:<sha>`).

**The problem:** an image sitting in a registry is like a packed suitcase in a storage room. Nobody can use the app. Nobody on the internet can open it.

**Project 8 = actually deploying it.** "Deployed" means:

1. It runs on a **server** (a computer that is always on, not your laptop).
2. It has a **name** (`devops.test` locally, a real domain later) and **HTTPS** (the lock icon).
3. The server is **locked down** (only key login, firewall).
4. A `git push` **updates the live site by itself** (no manual copying).
5. The data is **backed up** every day, and we know the restore works.

That's the whole job of a junior DevOps person in one project: take the app from "works on my machine" to "runs safely on a server".

---

## Why a VM on my PC first? (Phase A vs Phase B)

A real server (VPS) costs money and needs a domain. So we split it:

| | Phase A (now) | Phase B (at the end) |
|---|---|---|
| Server | Multipass VM `vps` on my PC (10.97.0.133) | Rented Hetzner VPS, a few hours |
| Name | Fake `devops.test` in `/etc/hosts` | Real domain, DNS record |
| HTTPS cert | Our own small CA (openssl) | Real Let's Encrypt |
| Who deploys | Self-hosted runner on my PC | GitHub's normal runner |
| Cost | Free | A few cents |

**Why this works:** the VM is a real Ubuntu Linux with real SSH, firewall, systemd, cron and Docker. Everything you learn in Phase A is the same on a real VPS. Phase B is just "do it again, for real, faster".

---

## Step 1: Create the "server" and log in with an SSH key ✅

**What we did**
- Installed Multipass and created an Ubuntu 24.04 VM called `vps`.
- Made an SSH key pair (`ssh-keygen -t ed25519`) and put the **public** key on the VM.
- Logged in with `ssh ubuntu@10.97.0.133`, no password.

**Why**
A server on the internet gets attacked within minutes. Passwords can be guessed or stolen. A key cannot be guessed.

**How a key works (simple version)**
- **Private key** = stays on your PC, never leaves it. Like your signature.
- **Public key** = goes on the server in `~/.ssh/authorized_keys`. Like a copy of your signature the bank keeps to check against.
- When you log in, the server sends a challenge, your PC **signs** it with the private key, the server checks the signature with the public key. The private key never travels.

**The other key: the server's host key**
The first time you connect, SSH asks "are you sure? fingerprint ...". That is the **server** showing its ID, saved in your `~/.ssh/known_hosts`. It protects **you** from connecting to a fake server (man-in-the-middle).
(This was mistake R80: it's not about your key.)

**Problems we solved**
- Snap store unreachable → the corporate proxy. snapd ignores shell proxy settings → `snap set system proxy...`.
- Multipass couldn't download the Ubuntu image (proxy CA again) → downloaded it with curl and launched from the file.

**Mini break-it:** "REMOTE HOST IDENTIFICATION HAS CHANGED" → the server's host key changed. Correct fix: check the real fingerprint another way first, then `ssh-keygen -R <ip>`. Never just delete it blindly; that is what an attacker wants.

---

## Step 2: Harden the server (user, SSH rules, firewall) ✅

**What we did**
- Created our own user `tazo` with `sudo` (don't work as `root`).
- SSH rules in a drop-in file `/etc/ssh/sshd_config.d/10-hardening.conf`:
  - `PermitRootLogin no` → nobody can log in as root.
  - `PasswordAuthentication no` → only keys work.
- Firewall `ufw`: block everything incoming, allow only **22** (SSH), **80** (HTTP), **443** (HTTPS).
- Automatic security updates (`unattended-upgrades`).

**Why**
Every open door is a way in. We close all doors except the three we need, and the SSH door only opens with a key, never for root.

**Important habits we learned**
- **Test the new login in a second terminal before closing the first.** The old session stays connected even if you broke the config, so it's your lifeline to undo it.
- **Read the prompt** before system commands (we once ran ufw on the PC instead of the VM).
- **"Connection timed out"** = firewall/network dropped it. **"Permission denied"** = sshd said no (R81).
- **Read the server log** (`journalctl -u ssh`) when the client message is unclear. The client says little, the server says why.

**Mini break-it:** `tazo` login refused → hidden `AllowUsers ubuntu` line (a whitelist without tazo). Found via `journalctl -u ssh`.

---

## Step 3: Docker on the server + pull our image ✅

**What we did**
- Made the VM trust the corporate MIA CA + set the apt proxy (only because of the office network; a real VPS won't need this).
- Installed Docker from Docker's official apt repo, set the **daemon** proxy in `/etc/docker/daemon.json`.
- Added `tazo` to the `docker` group.
- `docker login ghcr.io` with a token that can **only read packages**.
- Pulled our image by its commit sha.

**Why pull instead of build on the server?**
- The server runs the **exact same image CI tested**. Rebuilding could give a slightly different result.
- The server needs no source code, no git, no build tools → less to attack, less CPU/RAM, faster.

**Why a read-only token?**
The token is saved in plain text in `~/.docker/config.json`. If the server gets hacked, a read-only token can't push a poisoned image or touch your repos. (Least privilege: give only what's needed.)

**Things to remember**
- The `docker` group = **root-equivalent** (anyone in it can mount `/` into a container) (R84).
- Groups are read at **login** → after `usermod`, log out and in again.
- `docker login` alone = Docker Hub; for GHCR you must write `docker login ghcr.io`.
- `not found` ≠ `unauthorized`: `not found` means login is fine but that tag doesn't exist.

**Mini break-it:** `docker pull` → "proxyconnect ... :3129 connection refused" → wrong port in `daemon.json` (3129 instead of 3128). Lesson: the Docker **daemon** (a root service) does the download, not your shell, so it has its own proxy config. Also: read the error first (no "x509" = not a certificate problem).

---

## Where we are now

```
 [Your PC]                                 [VM "vps" = our pretend server]
  git push                                   ✅ Ubuntu, key-only SSH, firewall 22/80/443
     │                                       ✅ Docker installed, logged in to GHCR
     ▼                                       ✅ our API image pulled
  GitHub Actions ──build──► GHCR ──pull──►   ⬜ app not running yet (Step 4)
  (project 7)                                ⬜ no name / HTTPS yet (Step 5)
                                             ⬜ no auto-deploy yet (Step 6)
                                             ⬜ no backups yet (Step 7)
```

So far we **prepared the server**. The image is on it, but nothing is running yet.

---

## What's coming (one line each)

| Step | What | Problem it solves |
|---|---|---|
| 4 | Copy compose files + `.env` to the VM, `docker compose up -d` | The app actually runs on the server, and comes back after a reboot |
| 5 | `devops.test` name + HTTPS with our own CA | People use a name, not an IP; traffic is encrypted and the server proves who it is |
| 6 | CI deploy job: SSH into the VM, pull the new sha, restart | `git push` updates the live site with no manual work (zero-touch) |
| 7 | Daily `pg_dump` with cron + test a restore | If the DB is lost, the data comes back. An untested backup is not a backup |
| 8 | Break it (port 443 blocked, CI SSH key missing, disk full) | Practice the real on-call debugging |
| 9 | Explain-it run | You can explain every part of the path |
| 10 | Do it all on a real VPS with a real domain + Let's Encrypt | The real thing, on the internet |
| 11 | Cleanup + cheat sheet | Delete the VPS, revoke tokens, quiz |

---

## The whole path in one sentence (the goal at the end)

You `git push` → CI tests and builds an image → pushes it to GHCR → SSHes into the server → the server pulls that exact image → `docker compose up` → users open `https://domain` → firewall lets 443 in → nginx (HTTPS) → API → Postgres, which `cron` backs up with `pg_dump` every night.

Every step of project 8 adds one piece of that sentence.
