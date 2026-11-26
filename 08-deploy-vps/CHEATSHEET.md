# Cheat sheet — Deploy to a VPS

> My own answers (write them under each question, then ask for a check).
>
> 🧪 = made-up scenario (didn't happen in our setup) · 📄 = about our real files (file + line given, open it)
>
> Exact commands may be looked up. What counts is the idea: what to check, and why.

## SSH and users
1. 🧪 You run `ssh tazo@1.2.3.4` and get `Permission denied (publickey)`. A minute later a teammate tries the same server and their `ssh` just hangs until "Connection timed out". Which of the two is a firewall/network problem and which is an sshd login problem? How do you tell?
   - 
2. 🧪 You rebuild a server from scratch at the same IP. Your next `ssh` prints a big warning that the "remote host identification has changed" and refuses to connect. What is ssh comparing, where does that value come from on the server, and why is refusing the safe default?
   - 
3. 🧪 A teammate copies your `authorized_keys` to a new user with plain `sudo cp` and the new user still gets `Permission denied (publickey)`, although the key in the file is correct. What is wrong with the file, and where on the server would you read the real reason?
   - 
4. 🧪 Three developers and one CI pipeline need access to a server. How many users / keys would you create, who gets `sudo`, and who gets the `docker` group? Why is the `docker` group a big decision?
   - 
5. 🧪 After a break your terminal looks the same as before, you paste a `sudo ufw ...` command, and it changes the wrong machine. Which part of the screen would have told you, and when must you look at it?
   - 

## Firewall and ports
6. 🧪 You are about to run `sudo ufw enable` on a fresh server over SSH. What must be true first, what happens to your CURRENT session if you forget, and what happens to your NEXT login?
   - 
7. 🧪 A teammate adds `ports: ["5432:5432"]` to postgres "for debugging" and says "it's fine, ufw only allows 22, 80, 443". Is the database reachable from the internet? Why, and what are two safe alternatives?
   - 

## HTTPS and certificates
8. 📄 `nginx-live/default.conf:16` serves `/.well-known/acme-challenge/` on port 80. Who requests that URL, when, and what does it prove? What happens in about three months if someone closes port 80 in the firewall?
   - 
9. 📄 `nginx-live/default.conf:22` (`return 301 ...`) and the `proxy_pass` lines further down both "send the request somewhere else". What is the difference between the two, seen from the browser?
   - 
10. 🧪 Someone deletes the certificate file that an nginx `listen 443 ssl` block points to and restarts nginx. Visitors report that plain `http://` stopped working too. Why does port 80 die when only the HTTPS part is broken?
    - 
11. 🧪 On the local VM our own CA signed the cert and `curl` needed our CA file; on the real server nobody had to install anything. Why does a Let's Encrypt cert work everywhere without that step?
    - 

## Deploy from CI
12. 📄 In `.github/workflows/ci.yml:130` the deploy job says `runs-on: ubuntu-latest`. For the local VM it said `self-hosted`. Why did the local VM need a runner on my PC, and why doesn't the VPS?
    - 
13. 🧪 A deploy needs two different secrets that are easy to mix up: an SSH private key and a registry token. Which one is used by whom, to connect to what? What would break if each one were missing?
    - 
14. 📄 `ci.yml:132` has `concurrency: production`. Today a new deploy sat on "waiting" for a long time. What was it waiting for, and why is "one deploy at a time" still a good rule?
    - 
15. 🧪 The new version is live and broken. Describe the rollback: what do you change, which two actions follow, and why does plain `docker compose restart` not do it?
    - 

## Backups and operations
16. 🧪 The backup folder has a fresh file from last night. Your boss asks "so we are safe?". Give two reasons why a file with the right date is not proof, and say where backups should NOT be stored.
    - 
17. 📄 `scripts/backup.sh:4` starts with `set -euo pipefail`. Without `pipefail`, what would the script report if `pg_dump` failed halfway through `pg_dump | gzip`?
    - 
18. 🧪 The site is down. `docker ps -a` shows nginx `Exited`, although its compose service has `restart: unless-stopped`. Name one situation where Docker does NOT bring it back, and explain why `migrate` has no restart policy at all (📄 `docker-compose.prod.yaml:22`).
    - 
19. 🧪 A server that worked for months suddenly can't insert rows, can't pull images and writes no logs, all at once. What single thing do you check first, and how would you have known a week earlier?
    - 

## Review from earlier projects
20. (R27) 🧪 The api image the server pulls is 1.4 GB and deploys are slow. Which Docker command shows you WHICH build step added the size, and what are the two usual culprits?
    - 
21. (R30) 🧪 After a deploy, `docker ps` on the server shows the api as `(unhealthy)`, but its logs look normal. Where do you look to see what the health check actually ran and what it returned? (Tool, not the Dockerfile.)
    - 
22. (R31) 🧪 That api stays `(unhealthy)` for an hour and plain Docker never restarts it. Is that a bug? Who or what normally reacts to "unhealthy"?
    - 
23. (R37) 🧪 A teammate wants pgAdmin running on the live server on a public port "so we can look at the data quickly". What is the risk, and how would you give them access without opening a port?
    - 

## Commands I used
| Command | What it does |
|---------|--------------|
| `ssh do` (with a `Host do` block in `~/.ssh/config`) | |
| `adduser tazo` + `usermod -aG sudo tazo` | |
| `rsync --archive --chown=tazo:tazo ~/.ssh /home/tazo` | |
| `sudo sshd -t` / `sudo sshd -T` | |
| `sudo systemctl reload ssh` | |
| `sudo ufw allow 22/tcp` → `sudo ufw enable` → `sudo ufw status verbose` | |
| `sudo journalctl -u ssh` | |
| `docker login ghcr.io -u tazo-taz` | |
| `sudo certbot certonly --standalone -d <domain>` | |
| `sudo certbot renew --dry-run` | |
| `docker compose pull` + `docker compose up -d` | |
| `crontab -e` / `crontab -l` | |
| `df -h` | |
| `cat <file>` vs typing `<file>` alone | |
