# Project 2 — Dockerize a NestJS app

**Goal:** Create a simple NestJS API with one `/health` endpoint, write a `Dockerfile` and a `.dockerignore`, then build and run it as a container.
**You learn:** Dockerfile instructions (`FROM`, `WORKDIR`, `COPY`, `RUN`, `CMD`) and layer caching.
**Done when:**
- [x] `docker run -p 3000:3000 my-api` works
- [x] `curl localhost:3000/health` responds

> From project 1: image = read-only template made of layers, container = instance with its own writable layer.
> Now we write the recipe (`Dockerfile`) that *makes* an image ourselves.

---

## Step 1 — Create the NestJS app and run it locally (no Docker yet) ✔ DONE
- Concept: before you containerize an app, make sure it runs normally. Docker packages a working app; it doesn't fix a broken one.
- Commands: `npx @nestjs/cli new api --package-manager npm --skip-git`, `cd api`, `npm run start:dev`, `curl localhost:3000`
- Look at: `package.json` scripts (`build`, `start`, `start:prod`), `src/main.ts` (the port), `dist/` after `npm run build`.
- ✅ Checkpoint: `curl localhost:3000` returns "Hello World!" from the app running on your machine.

## Step 2 — Add the `/health` endpoint ✔ DONE
- Concept: a health endpoint is a cheap URL that says "I'm alive". Docker, load balancers and Kubernetes use it later to check your app.
- Code: a `GET /health` route returning `{ "status": "ok" }` (plus uptime/timestamp if you like). Read the port from `process.env.PORT ?? 3000`.
- ✅ Checkpoint: `curl localhost:3000/health` → `{"status":"ok",...}`. Stop the local app afterwards (port 3000 must be free).

## Step 3 — First Dockerfile (the naive version) ✔ DONE
- Concept: a `Dockerfile` is a recipe; every instruction makes a layer.
  `FROM` (base image) → `WORKDIR` (cd + mkdir inside the image) → `COPY` (files from your PC into the image) → `RUN` (command at **build** time) → `EXPOSE` (documentation) → `CMD` (command at **container start**).
- Write it the simple way first: `COPY . .` then `RUN npm install` then `RUN npm run build`.
- Commands: `docker build -t my-api .`, `docker images my-api`
- ✅ Checkpoint: build succeeds; you can say the difference between `RUN` and `CMD`.

## Step 4 — Run the container and hit `/health` ✔ DONE
- Commands: `docker run -d --name api -p 3000:3000 my-api`, `docker ps`, `docker logs api`, `curl localhost:3000/health`
- Try: `-e PORT=4000 -p 3000:4000` to see env vars + port mapping working together.
- ✅ Checkpoint: `/health` answers from the container. (Done criteria #1 and #2)

## Step 5 — `.dockerignore` and the build context ✔ DONE
- Concept: `docker build .` sends the whole folder (the **build context**) to the daemon. `node_modules`, `dist`, `.git` don't belong there: slow, huge, and your Linux `node_modules` may not match the image's.
- Compare the "transferring context" size in the build output before and after adding `.dockerignore`.
- ✅ Checkpoint: context drops from many MB to a few KB; image still works.

## Step 6 — Layer caching (reorder for fast rebuilds) ✔ DONE
- Concept: Docker reuses a cached layer if the instruction and its input files didn't change. Once one layer changes, every layer **after** it is rebuilt.
- Experiment: change one line in a controller → rebuild → watch `npm install` run again (slow).
- Fix: `COPY package*.json ./` → `RUN npm ci` → `COPY . .` → `RUN npm run build`. Change code again → `npm ci` shows `CACHED`.
- ✅ Checkpoint: a code-only change rebuilds in seconds; you can explain why the order matters.

## Step 7 — Look inside the image ✔ DONE
- Commands: `docker history my-api` (layers + sizes), `docker image inspect my-api`, `docker exec -it api sh` (what got copied in?), tags (`my-api:1.0`).
- Notice the size (~1 GB+ on `node:22`). Making it small is project 4.
- ✅ Checkpoint: you can point at the biggest layers and say where they come from.

## Step 8 — Cleanup + cheat sheet ✔ DONE
- Remove lesson containers, check `docker system df`, write `CHEATSHEET.md` (Dockerfile instructions + build/cache commands) in your own words.
- ✅ Checkpoint: "Done when" boxes above are ticked.

---

## Notes / lessons learned
### Step 1
- `npm install` crashed: "Cannot read properties of null (reading 'edgesOut')" = bug in npm 10.9's dependency resolver with the new NestJS 12 template (vite 8 / vitest 4 / TS 6 peer deps). Not my code. Fix: `npm install -g npm@11` (Node is from nvm → no sudo).
- ⚠️ The `node:22` Docker image ships npm 10 too → same crash inside `docker build`. The image has its own tools, not the ones on my PC.
- Template now uses vitest (not jest) and oxlint (not eslint); `"type": "module"` → imports end in `.js`.
- `curl localhost:3000` → "Hello World!" (route `@Get()` in app.controller.ts → AppService.getHello()). Port: `process.env.PORT ?? 3000` in main.ts.
- `nest start` compiles TypeScript (`src/`) into JavaScript (`dist/`); `start:prod` = `node dist/main` (no compiler needed) → this is what the container will run.
- curl tip: `curl -s` hides the progress meter.
### Step 2
- `/health` → `{"status":"ok","uptime":6.29,"timestamp":"..."}`. Returning an object from a controller = JSON automatically.
- Controller must be registered in `app.module.ts` (`controllers: [...]`) or the route doesn't exist (the CLI does this for you).
- Route = `@Controller('prefix')` + `@Get('path')`. Convention: put the prefix on the controller (`@Controller('health')` + `@Get()`), so all routes of one feature share it.
- Cleanups: removed unused `AppService` import; `npm run format` (prettier) fixes quotes/semicolons to the project style.
- Health endpoint = cheap "I'm alive" URL; later used by Docker HEALTHCHECK, load balancers, Kubernetes probes.
### Step 3
- Used `FROM node:24` (ships npm 11) instead of `node:22` (npm 10 → 'edgesOut' crash). The image brings its own tools → pick them on purpose.
- Mistake: `docker build -t my-api` → "requires 1 argument". The final `.` = build context (the folder `COPY` can see) is required.
- Mistake: forgot `RUN npm run build`. It still "worked" because `COPY . .` copied my PC's old `dist/` → image would ship stale code. `npm install` = dependencies → `node_modules/`; `npm run build` = compile my TS → `dist/`.
- `RUN` = at build time, result saved as a layer. `CMD` = at container start. Build once in the image, not on every start.
- `docker history my-api`: `COPY . .` = 184MB because it copied my local `node_modules` + `dist` (no .dockerignore yet); `npm install` only 3.1MB (almost nothing left to do); `npm run build` 246kB. Image 1.86GB, mostly `node:24` base.
- Editor saved the Dockerfile with CRLF (Windows) line endings (`cat -A` shows `^M`). OK in a Dockerfile, breaks shell scripts in Linux containers → switch editor to LF.
### Step 4
- `docker run -d --name api -p 3000:3000 my-api` → `/health` answers from the container. Both "Done when" criteria met.
- Logs start with `> api@0.0.1 start:prod` / `> node dist/main` = npm printing the script (CMD is `npm run start:prod`).
- `api2`: `-e PORT=4000 -p 3001:4000` → works on localhost:3001. My code picks the listen port (`process.env.PORT ?? 3000`), `-p` forwards host→container.
- `EXPOSE 3000` = only a label/documentation (stored as `ExposedPorts` in the image). Doesn't open or block anything; api2 listened on 4000 anyway. Only `docker run -P` (random host ports) uses it.
- Rule: container side of `-p` = the port the app REALLY listens on. Without `-p`, EXPOSE alone publishes nothing.
- Inside: PID 1 = `npm`, which starts `sh` → `node` (pid 19 in Nest logs). Running node directly as PID 1 is better for clean shutdown → project 4.
### Step 5
- `.dockerignore` = `.gitignore` for the build context: `.git`, `node_modules`, `dist` are never sent to the daemon.
- Result: `COPY . .` layer 184MB → 434kB. `npm install` layer 3.1MB → 238MB, because now it REALLY installs inside the image (Linux, devDeps included) instead of reusing my PC's `node_modules`.
- New problem it uncovered: `SELF_SIGNED_CERT_IN_CHAIN`. Office network = proxy `proxy.mia.gov.ge` that inspects HTTPS and re-signs it with `MIA-ROOT-CA`. My PC trusts that CA (`/usr/local/share/ca-certificates/` + `NODE_EXTRA_CA_CERTS`), the clean `node:24` image doesn't. Direct internet (no proxy) is blocked.
- Fix: BuildKit secret, cert exists only during that one RUN, never stored in a layer:
  `RUN --mount=type=secret,id=ca,target=/tmp/ca.crt NODE_EXTRA_CA_CERTS=/tmp/ca.crt npm install`
  + `docker build --secret id=ca,src=/usr/local/share/ca-certificates/MIA-ROOT-CA.crt ...`
- Not COPYing the cert into the image: it's specific to my office network; CI (project 7) and VPS (project 8) don't need it. Without `--secret` the file is just missing and npm connects normally.
- Never "fix" it with `strict-ssl=false` / `NODE_TLS_REJECT_UNAUTHORIZED=0` = trust anyone (fake packages possible).
- Added a `docker()` function in `~/.bashrc` (backup: `~/.bashrc.bak-2026-10-29`) that adds `--secret` to every `docker build` automatically. `docker compose build` will need it in the compose file (project 3).
- Mistake: pasted the Dockerfile `RUN ...` line into bash → "RUN: command not found". Dockerfile instructions only go in the Dockerfile.
### Step 6
- Naive order (`COPY . .` before `npm install`): one changed line in a controller → `COPY . .` changes → `npm install` + build + export of the ~238MB layer run again. 1.5s (all cached) → **15.6s**.
- Fix: `COPY package*.json ./` → `RUN npm ci` → `COPY . .` → `RUN npm run build`. Code change → `npm ci` stays `CACHED`, only copy + build run, export 7.7s → 0.2s. **15.5s → 3.3s**.
- Rule: put things that change rarely (dependencies) at the top and things that change often (my code) at the bottom. A changed layer rebuilds every layer below it.
- `npm ci` (not `npm install`) = install exactly what's in `package-lock.json`, never change it → same versions on every build/CI run.
- The proxy cert needs BOTH halves: `~/.bashrc` `docker()` function *passes* `--secret` to the build; `RUN --mount=type=secret...` + `NODE_EXTRA_CA_CERTS` in the Dockerfile *uses* it. Only the step that downloads (`npm ci`) needs it.
### Step 7
- `docker history my-api`, biggest layers: 619MB `apt-get install` (node:24 build tools: gcc, python, git… not needed at runtime), 238MB my `npm ci`, 218MB Node.js itself (node:24). My app (`dist/`) = 64KB of ~1.8GB → shrink it in project 4.
- `npm ci` layer 238MB but `node_modules` only 176MB → the rest is npm's download cache (`/root/.npm`) left in the layer.
- `<missing>` in the IMAGE column is normal: only the top layer has its own image ID.
- `docker image inspect my-api --format '{{json .Config}}'` → `Cmd`, `WorkingDir: /app`, `ExposedPorts: 3000/tcp` = my Dockerfile instructions saved as image settings.
- `docker exec -it api sh`: no `.git`, `dist/` built inside the image (.dockerignore works). OS = Debian 12 bookworm (node:24 base), not my Ubuntu.
- Mistake: `docker tag api ...` → `api` is the CONTAINER name; tags are for IMAGES (`docker images` vs `docker ps`). No `docker ls` → `docker image ls` / `docker container ls`.
- `docker tag my-api my-api:1.0` → same IMAGE ID as `latest`: a tag is just a label pointing at an image, no copy. The next build moves `latest`, `1.0` stays → rollback.
### Step 8
- Removed lesson containers (`docker ps -a` empty). Kept `my-api:latest` / `my-api:1.0`. `docker system df`: build cache ~3GB, so `docker builder prune` is worth knowing.
- Wrote `CHEATSHEET.md`: 16 questions answered in my own words + command table.

---

## Summary
- Wrote my own `Dockerfile` for NestJS: `FROM node:24` → `WORKDIR /app` → `COPY package*.json` → `RUN npm ci` → `COPY . .` → `RUN npm run build` → `CMD npm run start:prod`. Both "Done when" criteria met.
- Core ideas: `RUN` = build time (a layer), `CMD` = start time. `.dockerignore` keeps the build context small. Order layers from rarely changed to often changed so the cache works (15.5s → 3.3s).
- `EXPOSE` = documentation only, `-p host:container` publishes. The container side = the port the app really listens on.
- Office proxy: CA cert passed as a BuildKit secret, never stored in the image.
- Image is ~1.9GB (base image build tools + node_modules); shrinking it = project 4.
- Next topic suggestion: Docker Compose. Run the app + Postgres together, container DNS (`postgres` hostname), `.env`, named volumes. Compose builds will need the CA secret in `docker-compose.yml`.
