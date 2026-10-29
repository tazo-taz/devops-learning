# Project 2 — Dockerize a NestJS app

**Goal:** Create a simple NestJS API with one `/health` endpoint, write a `Dockerfile` and a `.dockerignore`, then build and run it as a container.
**You learn:** Dockerfile instructions (`FROM`, `WORKDIR`, `COPY`, `RUN`, `CMD`) and layer caching.
**Done when:**
- [ ] `docker run -p 3000:3000 my-api` works
- [ ] `curl localhost:3000/health` responds

> From project 1: image = read-only template made of layers, container = instance with its own writable layer.
> Now we write the recipe (`Dockerfile`) that *makes* an image ourselves.

---

## Step 1 — Create the NestJS app and run it locally (no Docker yet)
- Concept: before you containerize an app, make sure it runs normally. Docker packages a working app; it doesn't fix a broken one.
- Commands: `npx @nestjs/cli new api --package-manager npm --skip-git`, `cd api`, `npm run start:dev`, `curl localhost:3000`
- Look at: `package.json` scripts (`build`, `start`, `start:prod`), `src/main.ts` (the port), `dist/` after `npm run build`.
- ✅ Checkpoint: `curl localhost:3000` returns "Hello World!" from the app running on your machine.

## Step 2 — Add the `/health` endpoint
- Concept: a health endpoint is a cheap URL that says "I'm alive". Docker, load balancers and Kubernetes use it later to check your app.
- Code: a `GET /health` route returning `{ "status": "ok" }` (plus uptime/timestamp if you like). Read the port from `process.env.PORT ?? 3000`.
- ✅ Checkpoint: `curl localhost:3000/health` → `{"status":"ok",...}`. Stop the local app afterwards (port 3000 must be free).

## Step 3 — First Dockerfile (the naive version)
- Concept: a `Dockerfile` is a recipe; every instruction makes a layer.
  `FROM` (base image) → `WORKDIR` (cd + mkdir inside the image) → `COPY` (files from your PC into the image) → `RUN` (command at **build** time) → `EXPOSE` (documentation) → `CMD` (command at **container start**).
- Write it the simple way first: `COPY . .` then `RUN npm install` then `RUN npm run build`.
- Commands: `docker build -t my-api .`, `docker images my-api`
- ✅ Checkpoint: build succeeds; you can say the difference between `RUN` and `CMD`.

## Step 4 — Run the container and hit `/health`
- Commands: `docker run -d --name api -p 3000:3000 my-api`, `docker ps`, `docker logs api`, `curl localhost:3000/health`
- Try: `-e PORT=4000 -p 3000:4000` to see env vars + port mapping working together.
- ✅ Checkpoint: `/health` answers from the container. (Done criteria #1 and #2)

## Step 5 — `.dockerignore` and the build context
- Concept: `docker build .` sends the whole folder (the **build context**) to the daemon. `node_modules`, `dist`, `.git` don't belong there: slow, huge, and your Linux `node_modules` may not match the image's.
- Compare the "transferring context" size in the build output before and after adding `.dockerignore`.
- ✅ Checkpoint: context drops from many MB to a few KB; image still works.

## Step 6 — Layer caching (reorder for fast rebuilds)
- Concept: Docker reuses a cached layer if the instruction and its input files didn't change. Once one layer changes, every layer **after** it is rebuilt.
- Experiment: change one line in a controller → rebuild → watch `npm install` run again (slow).
- Fix: `COPY package*.json ./` → `RUN npm ci` → `COPY . .` → `RUN npm run build`. Change code again → `npm ci` shows `CACHED`.
- ✅ Checkpoint: a code-only change rebuilds in seconds; you can explain why the order matters.

## Step 7 — Look inside the image
- Commands: `docker history my-api` (layers + sizes), `docker image inspect my-api`, `docker exec -it api sh` (what got copied in?), tags (`my-api:1.0`).
- Notice the size (~1 GB+ on `node:22`). Making it small is project 4.
- ✅ Checkpoint: you can point at the biggest layers and say where they come from.

## Step 8 — Cleanup + cheat sheet
- Remove lesson containers, check `docker system df`, write `CHEATSHEET.md` (Dockerfile instructions + build/cache commands) in your own words.
- ✅ Checkpoint: "Done when" boxes above are ticked.

---

## Notes / lessons learned
### Step 1
### Step 2
### Step 3
### Step 4
### Step 5
### Step 6
### Step 7
### Step 8

---

## Summary
_(written at the end)_
