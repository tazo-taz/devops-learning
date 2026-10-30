# Cheat sheet — NestJS + Postgres with Docker Compose

> My own answers, checked and corrected after the project. (`✅ Answer (Claude)` = ones I couldn't answer myself → review these.)

## Compose basics
1. What is Docker Compose, and how is `docker compose up -d` related to the plain `docker` commands from projects 1–2?
   - so compose is for local services, when we created docker compose yaml and using docker compose we are directly working on those services in that services not global one and docker is for global, so i did not literally mean global local, local i meant in some folders yaml files which we work on and without compose does not check yaml
2. What is a "service" in `docker-compose.yaml`? What's the difference between `image:` and `build:`?
   - service is whole block, container, which we configure from some image, image is from based on some image to download and build is when we are creating from scratch like node project
3. Why was `context: api/Dockerfile` wrong? What does `context` point to?
   - some similar docker build -t --name api my-api . this "." meant folder in which we should move files same is we do api folder and in there it searches Dockerfile
4. `docker compose up -d` vs `docker compose up -d --build`: when does Compose rebuild the image, and when do you end up running old code? (And why did `docker compose up -d build` fail?)
   - we need docker compose up -d --build when we are working on custom not some downloaded image, --build actaully builds like cached or run time thing, so when we change some code we need to --build and actually build it, last part it needed --build not just build

## Networking
5. Inside the api container, what does `localhost` mean? Why did `localhost:5432` fail there, while `postgres:5432` worked?
   - because localhost:5432 means from current computer/container in same environment but when api service needs to connect to postgres and we write localhost it search in api container not in global
6. Who is `ports: "5432:5432"` on the postgres service for? Does the api need it? How did you prove it?
   - this one is to make "expose" to my pc to actually connect with localhost:5432, api does not need it they are in same network and will connect with postgres:5432
7. What does Compose create a network for, and why should you connect by service name and not by IP?
   - name and not ip because ip everytime we recreate network it changes, we do create newtwork so we can connect like postgres:5432 from api service

## Volumes and data
8. What is a named volume? Why is yours called `03-compose-postgres_pgdata`, and what was the other volume with the long hash name?
   - it checked foldername and added pgdata because it is posgress volume data i think, yes pgdata from yaml, it was for other postgress i think
     > ✅ Answer (Claude): Named volume = storage managed by Docker outside the container, survives `rm`/`down`. Compose adds the project (folder) name in front of the name I wrote in the YAML (`pgdata`) → `03-compose-postgres_pgdata`. The hash one = an **anonymous** volume from project 1: I ran `docker run postgres` without `-v`, the image declares its data folder as a volume, so Docker created one with no name.
9. What do `docker compose stop`, `down` and `down -v` each remove (containers / network / volume)?
   - stop keeps everything just stops, down removes but keep volume and -v removes everything
10. You changed `DB_PASSWORD` to `app2` in `.env` and the api crashed with "password authentication failed". Why didn't Postgres take the new password, and what are two ways to fix it?
    - password was kept in volume when it created first time, when we change it still compare that and and thats why, one is to change password on that postgres second change to real password

## Config and `.env`
11. How does `${DB_PASSWORD}` in the YAML get its value? Why is `.env` not committed, what is `.env.example` for, and how do you check that git ignores `.env`?
    - ${DB_PASSWORD} is get from .env because it is not hardcoded and when need to use multiple times it's better practise, .env.example is to have similar structure of real .env without actual secrets, we do not keep .env in git because everyone can see and it is not secret anymore
12. You wrote `DB_DB` instead of `DB_NAME` and the app still connected. Why, and which command shows the env vars a container really got?
    - because default it was connected with app but if we change user from account it still connected to user, dont remember command
      > ✅ Answer (Claude): `DB_NAME` was never set (YAML had `DB_DB`) → `database: undefined` → the `pg` driver falls back to "database = user name" = `app`, which happened to exist. Worked by luck. Check what the container really got: `docker compose exec api printenv`.

## Building through the office proxy
13. How does the office CA cert reach `npm ci` during a Compose build (both parts of the YAML)? What was the Bake "additional privileges requested" error, and how did you fix it?
    - we pass our certificate to api to it can download freely
      > ✅ Answer (Claude): Two parts in the YAML: `api: build: secrets: [ca]` USES the secret, the top-level `secrets: ca: file: /usr/local/share/ca-certificates/MIA-ROOT-CA.crt` DEFINES it. The name `ca` matches `id=ca` in the Dockerfile's `RUN --mount=type=secret,...` line, so the cert exists only during `npm ci`, never in a layer. Error: Compose v5 builds with Bake, which blocks a compose file from reading files outside the project folder (protects e.g. `~/.ssh`). Fix: `export BUILDX_BAKE_ENTITLEMENTS_FS=0` in `~/.bashrc`.

## App and database
14. What does `synchronize: true` do? Why didn't the app crash after `down -v`, and why is it turned off in production?
    - it is turned off because it can delete data and best practise is migrations, syncronze does this automatically app did not crash because first it did this sync and then started app
15. The API returned 500 for a duplicate email. Where do you look for the real cause? And in `psql`: why did nothing happen when you typed `select * from user`, and why do you need `"user"` in quotes?
    - 1. we should search in logs, 2. we did not use ";" and that meant on enter continue in next line, 3. dont know why need ""
      > ✅ Answer (Claude): Real cause → `docker compose logs api` (showed `duplicate key value violates unique constraint`). `user` is a reserved word in Postgres: `select * from user;` returns my login name (`app`), not the table. Quotes `"user"` = "I mean the table named user".

## Reliability
16. What does `depends_on` do (and NOT do)? What does `restart: unless-stopped` do, and when does it NOT restart? Why did `/health` say "ok" while `/users` failed?
    - depends_on means first need to start which service they depend on and then this one, restarted: unless-stoped when error happens and it crashed unless it is done manualy to restart, health did okay because it says about node container app not postgress pg connection

## Review from earlier projects
17. A teammate runs `docker compose up -d` with `image: postgres@16` in the YAML and gets "invalid reference format". What's wrong, and what does `@` really mean? (R1)
    - it should be :16 to make version, idk what @ means
      > ✅ Answer (Claude): `:` = tag, a name that can move (`postgres:16` can point to a newer build tomorrow). `@` = digest, the exact fingerprint of one image (`postgres@sha256:...`), never changes. `@16` isn't a valid digest → invalid reference format.
18. You fixed a bug in `users.service.ts`, ran `docker compose up -d`, and the bug is still there. Name two different reasons from projects 2–3 why a container can run OLD code. (R6, R12)
    - need to be built so it actually builds new code and can run i guess
      > ✅ Answer (Claude): (1) `docker compose up -d` reuses the existing image → need `up -d --build`. (2) The image was built from stale files: no `RUN npm run build` in the Dockerfile (ships my PC's old `dist/`), or the file wasn't saved when I built.
19. You want to give the compose-built api image the tag `my-api:1.0`. Which name do you pass to `docker tag`: `03-compose-postgres-api-1` or `03-compose-postgres-api`? Why? (R8)
    - so tags works on actual builds so api one
20. Where can each of these lines go: a Dockerfile, `docker-compose.yaml`, or the terminal? `RUN npm ci` / `docker compose exec api sh` / `depends_on: [postgres]` / `COPY . .` (R7)
    - npm ci in dockerfile, exec in terminal and depends on in yaml

## Commands I used
| Command | What it does |
|---|---|
| `docker compose config` | to show full details of all services in that yaml |
| `docker compose up -d` | start in background already cached ones |
| `docker compose up -d --build` | run in background and if need build → ✅ always rebuilds the images first (layer cache keeps it fast), then starts |
| `docker compose ps` / `ps -a` | in currany yaml files services which are running and all including stopped |
| `docker compose logs -t --since 5m -f SERVICE` | last 5min logs from that service |
| `docker compose exec SERVICE CMD` | run cmd command in that service and exit after  |
| `docker compose exec api printenv` | show all env variables |
| `docker compose exec postgres psql -U app -d app` | connect to pg with user and pass → ✅ `-U` = user, `-d` = database name (no password needed inside the container) |
| `docker compose stop` / `start` | stop and start, stop does not delete just stops and start means start stopped one |
| `docker compose down` | delete containers in that yamls services |
| `docker compose down -v` | delete container in yamls including volumes |
| `docker volume ls` | show all volumns in pc |
| `docker network ls` / `docker network inspect NAME` | show all networks created and inspect show details of it |
| `git check-ignore -v .env` | forgot this on, i thnk do not commit this one put into .gitignore → ✅ only asks git: is `.env` ignored, and by which line of which `.gitignore`? No output = NOT ignored |
