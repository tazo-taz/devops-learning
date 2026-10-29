# Cheat sheet — Dockerize a NestJS app

> My own answers, checked and corrected after the project.

## Dockerfile instructions
1. What does `FROM` do, and why did we use `node:24` and not `node:22`?
   - `FROM` = the base image we start from (all its layers come with it). `node:22`/`node:24` are Debian-based images with Node + npm installed. We used `node:24` because `node:22` ships npm 10, which crashed (`edgesOut`); `node:24` ships npm 11. The image brings its own tools, not the ones on my PC.
2. What does `WORKDIR /app` do?
   - `cd /app` inside the image (creates the folder if missing). Every `COPY`, `RUN` and `CMD` after it works in `/app`. It doesn't copy anything by itself.
3. What does `COPY . .` do? What do the two dots mean?
   - Copies files from my PC into the image. First `.` = the build context (my project folder, minus `.dockerignore`), second `.` = the current WORKDIR (`/app`), not a subfolder.
4. What's the difference between `RUN` and `CMD`? When does each one run?
   - `RUN` = at **build** time, the result is saved as a layer (`npm ci`, `npm run build`). `CMD` = at **container start**, the default command (`npm run start:prod`). Build once in the image, not on every start.
5. What does `EXPOSE 3000` do, and what does it NOT do?
   - Only metadata/documentation ("this app uses 3000"). It does NOT publish or open the port. `-p` does that.

## Build context and .dockerignore
6. What is the "build context" (the `.` at the end of `docker build -t my-api .`)?
   - The folder that gets sent to Docker for the build. `COPY` can only see files inside it. Required argument.
7. What does `.dockerignore` do, and why do `node_modules`, `dist` and `.git` belong in it?
   - Like `.gitignore`, but for the build context: those files are never sent. Smaller and faster build. `node_modules` must be installed inside the image (Linux, right versions), `dist` must be built inside the image (otherwise stale code), and `.git` is useless and big.

## Layer caching
8. When does Docker reuse a cached layer, and what happens to the layers after a changed one?
   - Reused when the instruction and its input files didn't change. When one layer changes, it and every layer after it are rebuilt.
9. Why do we `COPY package*.json ./` and run `npm ci` BEFORE `COPY . .`?
   - So a code change doesn't reinstall dependencies. If `package*.json` didn't change, `npm ci` is `CACHED` and only copy + build run (15.5s → 3.3s). Things that change rarely go on top, things that change often go at the bottom.
10. `npm ci` vs `npm install`: which one goes in a Dockerfile, and why?
    - `npm ci`: installs exactly what's in `package-lock.json`, never changes the lock file, and fails if the two don't match → same versions on every build/CI run. `npm install` is for my PC when I add packages.

## Running containers
11. In `docker run -d --name api -p 3000:4000 -e PORT=4000 my-api`, what does each part mean?
    - `-d`: run in the background (detached)
    - `--name api`: name of the container
    - `-p 3000:4000`: host:container. 3000 = my PC/browser, 4000 = the port the app really listens on in the container
    - `-e PORT=4000`: env var, my app reads `process.env.PORT` and listens on 4000
    - `my-api`: the IMAGE to start from
12. Image vs container: which command lists which? Which one can you `docker tag`?
    - `docker images` = images (templates), `docker ps -a` = containers (running instances). You tag **images**. `api` is a container name, so `docker tag api ...` fails.

## Inspecting
13. Which command shows the layers and their sizes? Which command gives you a shell inside a running container?
    - `docker history my-api` = layers + sizes (`docker image inspect` = settings as JSON). `docker exec -it api sh` = shell inside.
14. Where does most of the 1.8GB image come from?
    - From the `node:24` base: 619MB build tools (gcc, python, git… not needed at runtime), 218MB Node itself, plus Debian files. My `npm ci` adds 238MB (node_modules + npm cache). My app (`dist/`) is only 64KB. A container is NOT a VM: it uses my PC's Linux kernel, and the image holds only files. Shrinking it = project 4.
15. What is a tag? If `my-api:latest` and `my-api:1.0` have the same IMAGE ID, how much extra disk space does `1.0` use?
    - A name/label pointing at an image, not a copy → 0 extra bytes. The next build moves `latest`, and `1.0` stays on the old image → I can roll back to it if something fails.

## Office network
16. Why did `npm install` fail with `SELF_SIGNED_CERT_IN_CHAIN` inside Docker but not on my PC, and how did we fix it without putting the cert in the image?
    - The office proxy inspects HTTPS and re-signs it with `MIA-ROOT-CA`. My PC trusts that CA, the clean `node:24` image doesn't. Fix: the `docker()` function in `~/.bashrc` adds `--secret id=ca,src=...MIA-ROOT-CA.crt` to `docker build`, and the Dockerfile uses it only during `npm ci`:
      `RUN --mount=type=secret,id=ca,target=/tmp/ca.crt NODE_EXTRA_CA_CERTS=/tmp/ca.crt npm ci`
      The cert is never saved in a layer. Never use `strict-ssl=false`.

## Commands I used
| Command | What it does |
|---|---|
| `docker build -t NAME .` | build an image called NAME from the current folder (build context) |
| `docker run -d -p H:C NAME` | start a container from image NAME in the background, host port H → container port C |
| `docker ps` / `docker ps -a` | all running containers / all containers including stopped |
| `docker logs NAME` | show logs from container |
| `docker exec -it NAME sh` | open sh in that container |
| `docker history IMAGE` | show the layers our image was made of + their sizes |
| `docker image inspect IMAGE` | რა კონფიგ მონაცემები აქვს მოცემულ imageს და დააბრუნოს JSON ფორმატში |
| `docker tag IMAGE NEW:TAG` | იგივე image-ს დაარქვას ახალი სახელი/ტაგი (ასლი არ იქმნება) |
| `docker rm -f NAME` | წაშალოს კონტეინერი, თუ მიმდინარეა შეაჩეროს და შემდეგ წაშალოს |
| `docker rmi IMAGE` | წაშალოს image |
| `docker system df` | გვაჩვენოს რა ადგილი აქვს დაკავებული კონტეინერებს, სურათებს, volume და ქეშს |
