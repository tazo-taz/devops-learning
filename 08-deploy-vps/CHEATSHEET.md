# Cheat sheet — Deploy to a VPS

> My own answers, checked and corrected after the project.
>
> 🧪 = made-up scenario (didn't happen in our setup) · 📄 = about our real files (file + line given, open it)
>
> Exact commands may be looked up. What counts is the idea: what to check, and why.

## SSH and users
1. 🧪 You run `ssh tazo@1.2.3.4` and get `Permission denied (publickey)`. A minute later a teammate tries the same server and their `ssh` just hangs until "Connection timed out". Which of the two is a firewall/network problem and which is an sshd login problem? How do you tell?
   - so first one permission denied, means my ssh public key is not in tazos users public keys so it can not check to give me permission second one second one as i remember we removed 22 port of ssh connection so it could not found that port
2. 🧪 You rebuild a server from scratch at the same IP. Your next `ssh` prints a big warning that the "remote host identification has changed" and refuses to connect. What is ssh comparing, where does that value come from on the server, and why is refusing the safe default?
   - refuse? so if my public ssh key is there it will let me connect, i think you meant known hosts issue, server regenerated everything including it's key which means my pc does not have that server as a known, which means it might be other 
3. 🧪 A teammate copies your `authorized_keys` to a new user with plain `sudo cp` and the new user still gets `Permission denied (publickey)`, although the key in the file is correct. What is wrong with the file, and where on the server would you read the real reason?
   - so ssh has logs which tells what is issue, issue can be ownership of file i think, if i am right elaborate my argument 
4. 🧪 Three developers and one CI pipeline need access to a server. How many users / keys would you create, who gets `sudo`, and who gets the `docker` group? Why is the `docker` group a big decision?
   - so i would create sudo for ci and for my, developers should only see logs of dockers and so on, not change anything
   - so i would create 3 for developers, one for me which ci would use, others wont have access to changing docker services only logs, accidently can shut down whole services
     > 💡 Answer: One user + one key PER person and a separate one for CI = 4 users, 4 keys (never shared, so you can remove one without touching the others, and logs show who did what). `sudo` only for the admin(s). CI gets no sudo, only the `docker` group (it must run `docker compose`). The `docker` group = root: `docker run -v /:/host ...` mounts the whole server's disk. So "logs only" developers must NOT be in it.
5. 🧪 After a break your terminal looks the same as before, you paste a `sudo ufw ...` command, and it changes the wrong machine. Which part of the screen would have told you, and when must you look at it?
   - i think connection lost you this command was run on my local pc
   - when code it should be tazo@ubuntu... this means server 

## Firewall and ports
6. 🧪 You are about to run `sudo ufw enable` on a fresh server over SSH. What must be true first, what happens to your CURRENT session if you forget, and what happens to your NEXT login?
   - this means all ports are disabled, current connection will be open new opes wont be connected untill we enabled 22
7. 🧪 A teammate adds `ports: ["5432:5432"]` to postgres "for debugging" and says "it's fine, ufw only allows 22, 80, 443". Is the database reachable from the internet? Why, and what are two safe alternatives?
   - we ufw only did that ports even though it did that ports still could not be accessable, that means that from my vps when i am inside can connect that's it, so it is much better to have private that pg and create pg admin in same compose which can connect internally
     > 💡 Answer: YES, it is reachable. Docker writes its own iptables rules for published ports, and they are applied BEFORE ufw's, so ufw never gets to block it. Safe: (1) no `ports:` at all, postgres stays on the internal compose network; (2) `127.0.0.1:5432:5432` (only the server itself) + an SSH tunnel from your PC.

## HTTPS and certificates
8. 📄 `nginx-live/default.conf:16` serves `/.well-known/acme-challenge/` on port 80. Who requests that URL, when, and what does it prove? What happens in about three months if someone closes port 80 in the firewall?
   - when we have nginx running automatically assigns 80 ports incoming http request to that server, if we close 80 port we just cant see anything
     > 💡 Answer: Let's Encrypt's servers request it, when a cert is issued and at every renewal (certbot puts a token file there). Serving the right token proves I control the domain. Port 80 closed → renewal fails quietly → after ~90 days the cert expires → every browser shows a certificate error.
9. 📄 `nginx-live/default.conf:22` (`return 301 ...`) and the `proxy_pass` lines further down both "send the request somewhere else". What is the difference between the two, seen from the browser?
   - it is for mainly 80 to redirect to 443 https
     > 💡 Answer: `return 301` = nginx tells the BROWSER "go to https://…": the browser makes a 2nd request and the URL bar changes. `proxy_pass` = nginx fetches the answer from `api:3000` ITSELF: one request, URL unchanged, the browser never learns `api` exists.
10. 🧪 Someone deletes the certificate file that an nginx `listen 443 ssl` block points to and restarts nginx. Visitors report that plain `http://` stopped working too. Why does port 80 die when only the HTTPS part is broken?
    - nginx can not start if someting wrong is in nginx so could not restart it
11. 🧪 On the local VM our own CA signed the cert and `curl` needed our CA file; on the real server nobody had to install anything. Why does a Let's Encrypt cert work everywhere without that step?
    - browser does that automatically
      > 💡 Answer: Let's Encrypt's root CA is already installed in every OS/browser trust store, so the signature chain checks out with nothing to install. Our own CA was in no trust store, so we had to hand curl the CA file.

## Deploy from CI
12. 📄 In `.github/workflows/ci.yml:130` the deploy job says `runs-on: ubuntu-latest`. For the local VM it said `self-hosted`. Why did the local VM need a runner on my PC, and why doesn't the VPS?
    - because locally on private network how would github vps would connect with shh, on real because it is public vps it can ssh
13. 🧪 A deploy needs two different secrets that are easy to mix up: an SSH private key and a registry token. Which one is used by whom, to connect to what? What would break if each one were missing?
    - it needs be in known hosts so it does not trigger anything like write y or something second is private key of ssh of which public key is in server, like dedicated ssh token should be created for ci cd
    - right, docker registry for permission to read
      > 💡 Answer: SSH private key: used by the CI RUNNER to log in to the SERVER; missing → the deploy job can't connect at all. Registry token (`read:packages`): used ON THE SERVER by `docker login ghcr.io` to pull the private images; missing → `docker compose pull` fails with `denied` / `unauthorized`.
14. 📄 `ci.yml:132` has `concurrency: production`. Today a new deploy sat on "waiting" for a long time. What was it waiting for, and why is "one deploy at a time" still a good rule?
    - right so it waits before deployment to be finished and then it will continue this one, like it will be in queue so race condition wont happen
15. 🧪 The new version is live and broken. Describe the rollback: what do you change, which two actions follow, and why does plain `docker compose restart` not do it?
    - open registry commits check before commit of latest or one with stage version of tag and then open ssh change .env and then docker compose up -d --no-build
    - it would restart current one not create again

## Backups and operations
16. 🧪 The backup folder has a fresh file from last night. Your boss asks "so we are safe?". Give two reasons why a file with the right date is not proof, and say where backups should NOT be stored.
    - check first if that backup file was saved succesfully also it should be in different server preferable to be in multiple server just in case
      > 💡 Answer: (1) The file can be empty or cut off (pg_dump failed, gzip still wrote a file); (2) nobody ever restored it, and a restore test is the only real proof. Also possible: wrong database in it. NOT stored only on the same server: if that server dies, the backup dies with it.
17. 📄 `scripts/backup.sh:4` starts with `set -euo pipefail`. Without `pipefail`, what would the script report if `pg_dump` failed halfway through `pg_dump | gzip`?
    - idk
      > 💡 Answer: It would report SUCCESS. A pipe's exit code = the LAST command's (gzip, which worked), so `set -e` sees 0 and the script goes on with a broken backup. `pipefail` = the pipe fails if ANY command in it fails.
18. 🧪 The site is down. `docker ps -a` shows nginx `Exited`, although its compose service has `restart: unless-stopped`. Name one situation where Docker does NOT bring it back, and explain why `migrate` has no restart policy at all (📄 `docker-compose.prod.yaml:22`).
    - manually stoped, migrate should exit 0 succesfully it is not long runnig process
19. 🧪 A server that worked for months suddenly can't insert rows, can't pull images and writes no logs, all at once. What single thing do you check first, and how would you have known a week earlier?
    - would check if space issue, add cron job or something of monitoring which alerts me on everything 

## Review from earlier projects
20. (R27) 🧪 The api image the server pulls is 1.4 GB and deploys are slow. Which Docker command shows you WHICH build step added the size, and what are the two usual culprits?
    - make sure docker ignore is there also there is some  command i forgot which layer by layer gives information of how many gb is each later
      > 💡 Answer: `docker history <image>` = every layer with its size. Usual culprits: a big base image (`node:24` ≈ 1.2 GB instead of alpine) and dev dependencies in `node_modules` (no multi-stage / no `npm ci --omit=dev`).
21. (R30) 🧪 After a deploy, `docker ps` on the server shows the api as `(unhealthy)`, but its logs look normal. Where do you look to see what the health check actually ran and what it returned? (Tool, not the Dockerfile.)
    - so what it depend on, also health check command which tells what is wrong and check those services 
      > 💡 Answer: `docker inspect <container> --format '{{json .State.Health}}'` = the last health check runs with output + exit code. `'{{json .Config.Healthcheck}}'` = the command it really runs.
22. (R31) 🧪 That api stays `(unhealthy)` for an hour and plain Docker never restarts it. Is that a bug? Who or what normally reacts to "unhealthy"?
    - no unhealth is warning like it will be for future kubernetes or something, here it means it working process but health check we assigned is not returning good results
23. (R37) 🧪 A teammate wants pgAdmin running on the live server on a public port "so we can look at the data quickly". What is the risk, and how would you give them access without opening a port?
    - security issue, not good idea to be it publicly accessable we if want that we should make connection from locally to server pg
      > 💡 Answer: SSH tunnel: `ssh -L 5432:localhost:5432 tazo@server`, then connect on your PC to `localhost:5432`. It rides on the SSH port that is already open; no new port. (Or pgAdmin behind `--profile tools`, bound to 127.0.0.1.)

## Commands I used
| Command | What it does |
|---------|--------------|
| `ssh do` (with a `Host do` block in `~/.ssh/config`) | alias for connection faster |
| `adduser tazo` + `usermod -aG sudo tazo` | create user tazo and add sudo permission |
| `rsync --archive --chown=tazo:tazo ~/.ssh /home/tazo` | forgot |
| `sudo sshd -t` / `sudo sshd -T` | forgit |
| `sudo systemctl reload ssh` | reload ssh program on server |
| `sudo ufw allow 22/tcp` → `sudo ufw enable` → `sudo ufw status verbose` | allow ssh login then permit all other ports and return which are accessable |
| `sudo journalctl -u ssh` | ssh connection logs |
| `docker login ghcr.io -u tazo-taz` | login in registry with user tazo-taz |
| `sudo certbot certonly --standalone -d <domain>` | add certificate for this domain |
| `sudo certbot renew --dry-run` | create new certificate |
| `docker compose pull` + `docker compose up -d` | pull image and run in bg |
| `crontab -e` / `crontab -l` | logs which are running |
| `df -h` | forgot |
| `cat <file>` vs typing `<file>` alone | show context |

> 💡 Answer: `rsync --archive --chown=tazo:tazo ~/.ssh /home/tazo` = copy root's `.ssh` folder (with `authorized_keys`) to the new user, keeping permissions, and make tazo the OWNER (sshd ignores key files owned by someone else).

> 💡 Answer: `sshd -t` = test the config for errors (like `nginx -t`); `sshd -T` = test + print the full effective config.

> 💡 Answer: `ufw enable` = turn the firewall ON: all incoming traffic is DENIED except the allowed ports (22). `status verbose` = show rules + defaults.

> 💡 Answer: `certbot renew --dry-run` = rehearse the renewal against a test server; nothing is changed. Proves the automatic renewal will work.

> 💡 Answer: `crontab -e` = edit my scheduled jobs, `crontab -l` = list them. Not logs.

> 💡 Answer: `df -h` = free / used disk space per filesystem, human-readable (G/M).

> 💡 Answer: `cat <file>` = print the content. A bare path = the shell tries to RUN the file as a program → needs the `x` permission → "Permission denied".
