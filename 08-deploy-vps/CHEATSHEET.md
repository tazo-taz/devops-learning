# Cheat sheet — Deploy to a VPS

> My own answers (write them under each question, then ask for a check).
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
     > 💡 Suggestion: CI with sudo is the risky part. How many users and keys in total (shared or one each)? And what can someone in the `docker` group do to the HOST (think `-v /:/host`)?
5. 🧪 After a break your terminal looks the same as before, you paste a `sudo ufw ...` command, and it changes the wrong machine. Which part of the screen would have told you, and when must you look at it?
   - i think connection lost you this command was run on my local pc
     > 💡 Suggestion: Right that it ran on your PC. But WHICH part of the screen shows the machine, and when do you look at it?

## Firewall and ports
6. 🧪 You are about to run `sudo ufw enable` on a fresh server over SSH. What must be true first, what happens to your CURRENT session if you forget, and what happens to your NEXT login?
   - this means all ports are disabled, current connection will be open new opes wont be connected untill we enabled 22
7. 🧪 A teammate adds `ports: ["5432:5432"]` to postgres "for debugging" and says "it's fine, ufw only allows 22, 80, 443". Is the database reachable from the internet? Why, and what are two safe alternatives?
   - we ufw only did that ports even though it did that ports still could not be accessable, that means that from my vps when i am inside can connect that's it, so it is much better to have private that pg and create pg admin in same compose which can connect internally
     > 💡 Suggestion: ufw does NOT protect a published Docker port. Who writes firewall rules before ufw gets to decide? Second alternative: what can you put in front of `5432:5432`?

## HTTPS and certificates
8. 📄 `nginx-live/default.conf:16` serves `/.well-known/acme-challenge/` on port 80. Who requests that URL, when, and what does it prove? What happens in about three months if someone closes port 80 in the firewall?
   - when we have nginx running automatically assigns 80 ports incoming http request to that server, if we close 80 port we just cant see anything
     > 💡 Suggestion: This is not about visitors. Who calls that URL when a certificate is issued or renewed, and what does a correct answer prove about the domain? Then: what happens to the cert after 90 days without it?
9. 📄 `nginx-live/default.conf:22` (`return 301 ...`) and the `proxy_pass` lines further down both "send the request somewhere else". What is the difference between the two, seen from the browser?
   - it is for mainly 80 to redirect to 443 https
     > 💡 Suggestion: That is only line 22. What does the BROWSER see differently with `proxy_pass` (number of requests, URL bar, does it know `api` exists)?
10. 🧪 Someone deletes the certificate file that an nginx `listen 443 ssl` block points to and restarts nginx. Visitors report that plain `http://` stopped working too. Why does port 80 die when only the HTTPS part is broken?
    - nginx can not start if someting wrong is in nginx so could not restart it
11. 🧪 On the local VM our own CA signed the cert and `curl` needed our CA file; on the real server nobody had to install anything. Why does a Let's Encrypt cert work everywhere without that step?
    - browser does that automatically
      > 💡 Suggestion: Automatically, but why? Where is Let's Encrypt's root CA already stored, and where was ours missing?

## Deploy from CI
12. 📄 In `.github/workflows/ci.yml:130` the deploy job says `runs-on: ubuntu-latest`. For the local VM it said `self-hosted`. Why did the local VM need a runner on my PC, and why doesn't the VPS?
    - because locally on private network how would github vps would connect with shh, on real because it is public vps it can ssh
13. 🧪 A deploy needs two different secrets that are easy to mix up: an SSH private key and a registry token. Which one is used by whom, to connect to what? What would break if each one were missing?
    - it needs be in known hosts so it does not trigger anything like write y or something second is private key of ssh of which public key is in server, like dedicated ssh token should be created for ci cd
      > 💡 Suggestion: SSH key part ✓. The registry token is missing: which machine uses it, to log in WHERE, and which step fails without it?
14. 📄 `ci.yml:132` has `concurrency: production`. Today a new deploy sat on "waiting" for a long time. What was it waiting for, and why is "one deploy at a time" still a good rule?
    - right so it waits before deployment to be finished and then it will continue this one, like it will be in queue so race condition wont happen
15. 🧪 The new version is live and broken. Describe the rollback: what do you change, which two actions follow, and why does plain `docker compose restart` not do it?
    - open registry commits check before commit of latest or one with stage version of tag and then open ssh change .env and then docker compose up -d --no-build
      > 💡 Suggestion: Steps ✓ (an exact old sha, not `latest`). Still open: why does `docker compose restart` not switch the image?

## Backups and operations
16. 🧪 The backup folder has a fresh file from last night. Your boss asks "so we are safe?". Give two reasons why a file with the right date is not proof, and say where backups should NOT be stored.
    - check first if that backup file was saved succesfully also it should be in different server preferable to be in multiple server just in case
      > 💡 Suggestion: "Saved successfully" is not something you can see from the file. What is the only real test of a backup? And how could a fresh file still be empty?
17. 📄 `scripts/backup.sh:4` starts with `set -euo pipefail`. Without `pipefail`, what would the script report if `pg_dump` failed halfway through `pg_dump | gzip`?
    - idk
      > 💡 Suggestion: A pipe's exit code comes from only one of its commands. Which one, and did it fail here?
18. 🧪 The site is down. `docker ps -a` shows nginx `Exited`, although its compose service has `restart: unless-stopped`. Name one situation where Docker does NOT bring it back, and explain why `migrate` has no restart policy at all (📄 `docker-compose.prod.yaml:22`).
    - manually stoped, migrate should exit 0 succesfully it is not long runnig process
19. 🧪 A server that worked for months suddenly can't insert rows, can't pull images and writes no logs, all at once. What single thing do you check first, and how would you have known a week earlier?
    - would check if space issue, add cron job or something of monitoring which alerts me on everything 

## Review from earlier projects
20. (R27) 🧪 The api image the server pulls is 1.4 GB and deploys are slow. Which Docker command shows you WHICH build step added the size, and what are the two usual culprits?
    - make sure docker ignore is there also there is some  command i forgot which layer by layer gives information of how many gb is each later
      > 💡 Suggestion: `.dockerignore` helps the context. The command you forgot shows an image's LAYERS with sizes (`docker h...`). Two usual culprits: the base image and what `npm ci` installs.
21. (R30) 🧪 After a deploy, `docker ps` on the server shows the api as `(unhealthy)`, but its logs look normal. Where do you look to see what the health check actually ran and what it returned? (Tool, not the Dockerfile.)
    - so what it depend on, also health check command which tells what is wrong and check those services 
      > 💡 Suggestion: `depends_on` doesn't show results. Which `docker` command prints a container's full state as JSON, including `.State.Health`?
22. (R31) 🧪 That api stays `(unhealthy)` for an hour and plain Docker never restarts it. Is that a bug? Who or what normally reacts to "unhealthy"?
    - no unhealth is warning like it will be for future kubernetes or something, here it means it working process but health check we assigned is not returning good results
23. (R37) 🧪 A teammate wants pgAdmin running on the live server on a public port "so we can look at the data quickly". What is the risk, and how would you give them access without opening a port?
    - security issue, not good idea to be it publicly accessable we if want that we should make connection from locally to server pg
      > 💡 Suggestion: Risk ✓. HOW do you connect from your PC to the server's postgres without opening a port? (One ssh flag.)

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

> 💡 Suggestion: `rsync --archive --chown=tazo:tazo` = think of Step 2: what did the new user need from root's `~/.ssh`, and why must the copy be OWNED by tazo?

> 💡 Suggestion: `sshd -t` / `-T` = same idea as `nginx -t`. One only checks, the other also prints something. What?

> 💡 Suggestion: `ufw enable` = "permit all other ports"? Check the default for incoming traffic.

> 💡 Suggestion: `certbot renew --dry-run` = look at the word "dry-run": does it change anything on the server?

> 💡 Suggestion: `crontab -e` / `-l` = not logs. `-e` = edit, `-l` = list... what?

> 💡 Suggestion: `df -h` = you used the idea in question 19. What does it show?

> 💡 Suggestion: `cat <file>` vs `<file>` alone = `cat` half ✓ (shows the content). What does the shell try to do with a bare path, and which permission does that need?
