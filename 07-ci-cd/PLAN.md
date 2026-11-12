# Project 7 — CI/CD with GitHub Actions

**Goal:** On every push: run lint and tests, build the Docker image, and push it to a registry (GitHub Container Registry, `ghcr.io`), tagged with the commit hash.
**You learn:** pipelines, image registries, secrets in CI, and versioning.
**Done when:**
- [ ] a `git push` that touches `07-ci-cd/` automatically runs lint + tests and produces a new image `ghcr.io/tazo-taz/...:<commit sha>` in the registry
- [x] a failing test stops the pipeline BEFORE any image is pushed
- [ ] (extra) CI starts the whole compose stack with the new image and `curl`s through nginx (smoke test), using CI secrets instead of a committed `.env`

> From project 6: nginx on port 80 in front of `web` + 2 api copies (`upstream` + `zone`), Redis cache, dev/prod compose overrides, one-shot `migrate`.
> Problem now: every check and build happens by hand on MY PC ("works on my machine"). Nobody stops a broken commit, and there is no stored, versioned image a server could pull (project 8 needs exactly that).
> Starting code = a copy of `06-nginx-proxy/` (without `node_modules`/`dist`/`uploads`, `.env` copied, still git-ignored).
> Monorepo detail: this whole workspace is ONE GitHub repo (`devops-learning`). GitHub only reads workflows from `.github/workflows/` at the REPO ROOT, so the workflow lives there and uses `paths:` + `working-directory:` to point at `07-ci-cd/`.
> Registry choice: GHCR, because it logs in with the built-in `GITHUB_TOKEN` (no extra account). Docker Hub works the same way with a username + access token secret.
> Method: Explain-it, not memorize. Looking up workflow syntax is fine; what matters is knowing WHAT exists and WHY.

Every step ends with 🔨 mini break-it(s): Claude quietly breaks one thing and gives only the symptom. Keep the files closed until you've looked (Actions tab logs, `git log`, `docker` tools).

---

## Step 0 — Warm-up (no notes) ✔ DONE
- 3 recall questions in chat: 1 from project 6, 2 open `REVIEW.md` items. Update streaks.

## Step 1 — Be the pipeline by hand ✔
- Concept: CI = a fresh machine runs the SAME commands I'd run (`npm ci`, `lint`, `test`, `docker build`) on every push. A step "fails" when its command exits non-zero (`echo $?`), and the pipeline stops there.
- 🤔 Predict: you run `npm ci && npm run lint && npm test && docker build ...` and the tests fail. Does the build run? Why does `&&` behave like a pipeline?
- Run lint, tests, build locally in `07-ci-cd/api`; read the exit codes. Fix whatever fails (find out WHY first: is the code wrong or the test?).
- [x] ✅ Checkpoint: all three pass locally. Why: in your words, why is "it passes on my PC" not enough?
- 🔨 Mini break-it: `package-lock.json` deleted → `npm ci` fails first (needs the lock). ✔

## Step 2 — First workflow: hello from GitHub ✔
- Concept: workflow (`.github/workflows/*.yml`) → triggered by an event (`on: push`) → jobs (each on a fresh VM, `runs-on: ubuntu-latest`) → steps (`run:` a shell command or `uses:` a ready-made action). Actions tab = logs.
- 🤔 Predict: you put the workflow file in `07-ci-cd/.github/workflows/` and push. What happens in the Actions tab?
- Write a tiny workflow that prints `uname -a`, `docker --version`, `node --version`, `pwd`, `ls`. Push, watch it run. Add `paths: ['07-ci-cd/**']` so other folders don't trigger it.
- [x] ✅ Checkpoint: green run in the Actions tab. Why: where does this code run, and what's on that machine when the job starts?
- 🔨 Mini break-it: `node --version` → `nodejs --version` → run red, exit 127. ✔

## Step 3 — Lint + test job ✔
- Concept: `actions/checkout` (the VM starts EMPTY, no code), `actions/setup-node` (+ npm cache), `defaults.run.working-directory`, `npm ci` vs `npm install`.
- 🤔 Predict: you skip `actions/checkout` and run `npm ci`. What error do you get?
- Job `test`: checkout → setup-node 24 → `npm ci` → `npm run lint` → `npm test`.
- [x] ✅ Checkpoint: green run, and the log shows the test count. Why: why `npm ci` and not `npm install` in CI?
- 🔨 Mini break-it: `cache-dependency-path` removed → setup-node fails (no lock file in repo root). ✔

## Step 4 — Build the image in CI ✔
- Concept: `docker/setup-buildx-action` + `docker/build-push-action` (build only, `push: false`). The Dockerfile's `--mount=type=secret,id=ca`: the CI runner is NOT behind the corporate proxy.
- 🤔 Predict: the Dockerfile mounts the `ca` secret, but CI doesn't pass one. Does the build fail? (Hint: are secret mounts required by default?)
- Job `build` with `needs: test` (only runs if tests passed).
- [x] ✅ Checkpoint: green build job after the test job. Why: what does `needs:` give you, and what would happen without it?
- 🔨 Mini break-it: `COPY . .` removed from the Dockerfile → test green, build red (`tsconfig.json` not found). ✔

## Step 5 — Push to GHCR, tagged with the commit hash ✔
- Concept: registry = a "GitHub for images" (`docker push` / `docker pull`). Full name `ghcr.io/<owner>/<image>:<tag>`. Login with `docker/login-action` + `GITHUB_TOKEN`; the job needs `permissions: packages: write`. Tags: `${{ github.sha }}` (exact, never changes) + `latest` (moves).
- 🤔 Predict: why tag with the commit sha at all, when `latest` already points at the newest image?
- Push the image, find it under the repo's Packages, `docker pull` it on my PC and run it.
- [x] ✅ Checkpoint: the image in GHCR has the same sha as `git log -1`. Why: which image would you deploy to roll back to yesterday, and how do you find it?
- 🔨 Mini break-it: image name `devops-API` → build red at push (repository name must be lowercase). ✔

## Step 6 — When to push: branches, PRs, versions ✔
- Concept: `on: push` vs `pull_request`; `if: github.ref == 'refs/heads/main'` (PRs only test, main also pushes); git tag `v1.0.0` → image tag `1.0.0` (`docker/metadata-action`). Semver = MAJOR.MINOR.PATCH.
- 🤔 Predict: a PR from a branch builds and PUSHES `latest`. What could go wrong?
- [x] ✅ Checkpoint: a push to a branch → tests only; push to main → image; tag `v1.0.0` → image `1.0.0`. Why: sha vs semver vs latest, who is each one for?
- 🔨 Mini break-it: `if:` checked `refs/heads/master` → build skipped on main. ✔

## Step 7 — Smoke test the stack in CI + secrets ✔
- Concept: unit tests check functions; a smoke test starts the real stack (compose: nginx + api + postgres + redis) and `curl`s it. `.env` is git-ignored, so CI has no DB password → GitHub repo **secrets** (`${{ secrets.X }}`), masked as `***` in logs. Compose's `ca` secret file only exists on MY PC.
- 🤔 Predict: CI runs `docker compose up` with our compose file. Which TWO things from my PC are missing on the runner?
- Job `smoke`: create `.env` from secrets, start the stack with the built image, wait for health, `curl localhost/api/users`, `down`.
- [x] ✅ Checkpoint: green smoke job; the password never appears in the log. Why: why not commit `.env`, and why not `echo` a secret to "debug" it?
- 🔨 Mini break-it: nginx upstream `api:3001` (api listens on 3000) → smoke red, 502. ✔

## Step 8 — Break it
- Claude breaks things one at a time, gives only the symptom (from ROADMAP): a failing test blocks the pipeline, a missing/wrong registry permission or secret, a YAML indentation error.
- Loop: symptom → look (Actions log, which step, exit code) → guess → test → fix → explain.
- [ ] ✅ Checkpoint: all three found and explained.

## Step 9 — Explain-it run
- Walk through the workflow file top to bottom: for each part say WHAT it does, WHY it's there, WHAT breaks without it. Plus 2–3 "what would you reach for when X?" questions. Lookups are fine.
- [ ] ✅ Checkpoint: every part explained; only wrong ideas / unknown features → `REVIEW.md`.

## Step 10 — Cleanup + cheat sheet
- Delete test images/tags you don't need (GHCR + local), `docker image prune`. `CHEATSHEET.md` as questions; I answer, Claude puts 💡 suggestions in the file.
- [ ] ✅ Checkpoint: "Done when" boxes ticked, Summary written.

---

## Notes / lessons learned
### Step 0
- Q1 (R50 ✓): `--scale api=3` → reload nginx. Why: nginx resolved `api` at startup (2 IPs) and never asks DNS again → the 3rd copy gets nothing until `nginx -s reload`/restart.
- Q2 (R55 ✓): without the named `pgdata` volume, `down` + `up` = new container + NEW anonymous volume → users gone. (Already restored in 07's compose.)
- Q3 (R45 ✓): anyone who can pull the image reads it (`docker history`/`inspect`). Extra: it stays in the image layers in the registry forever (deleting the line later doesn't remove old images), and one image for every env would share one password → secrets come in at RUNTIME (env/CI secrets).
### Step 1
- Predict ✓: `&&` runs the next command only if the previous one exited 0 (like JS short-circuit). `echo $?` = last exit code (0 ok, non-zero fail). CI checks every step's exit code the same way.
- Chain stopped at `npm test` (exit 1): `getHello()` returned the old slug test text, the test expected `Hello World!`. First edit still didn't match → reverted the code to `'Hello World!'`. Lesson: red test = code and test DISAGREE; decide which one is the truth (bug → fix code, intended change → update test).
- Checkpoint ✓: my PC has extra things installed/cached (global tools, old node_modules, other OS) that a clean machine doesn't. Also: CI runs EVERY time (people forget), on the COMMITTED code only (not unsaved/uncommitted files), and everyone sees the result.
- Mini break-it: lock file deleted → `npm ci` stops at once. Found the cause ✓. First fix idea `npm i` (R61): without a lock it installs the NEWEST versions the `^` ranges allow → not what was tested. Restored the committed one with `git restore` → exit 0.
### Step 2
- Mistake (R62): Predict said a workflow in `07-ci-cd/.github/workflows/` runs. No: only the repo-root `.github/workflows/` is read → silently nothing.
- Claude wrote `.github/workflows/ci.yml` (user decided: Claude writes new files, I explain them). `pwd` = `/home/runner/work/devops-learning/devops-learning`, `ls -la` = EMPTY: the runner starts without our code → `actions/checkout` needed.
- Checkpoint ✓ mostly: brand-new machine, none of our files. Correction (R63): it's a fresh VM (GitHub-hosted runner), not a Docker container, and Docker/Node/git are PREINSTALLED in the runner image, not downloaded per run.
- Mini break-it ✓: red run, step `nodejs --version` → `command not found`, exit 127 (shell's code for "command not found"; 1 = the program ran and reported a failure). The step that fails = the first red step in the log.
### Step 3
- Predict ✓: no checkout → no `package.json` (even earlier: the `working-directory` folder doesn't exist).
- Job `test`: checkout → setup-node 24 (npm cache) → `npm ci` → lint → test, `defaults.run.working-directory: 07-ci-cd/api`.
- Checkpoint (partly): "because of the lock file". Full: `npm ci` = exact lock versions + never rewrites the lock, FAILS if lock/package.json disagree or lock missing, deletes node_modules first (clean). `npm install` may update + rewrite the lock.
- Mini break-it ✔: `cache-dependency-path` line removed → setup-node fails before `npm ci` (looked for the lock file in the repo root). Cause found ✓. Learned: `defaults.run.working-directory` only affects `run:` steps; `uses:` actions ignore it and have their own `with:` inputs. The cache = npm's download folder `~/.npm` (not node_modules), saved/restored by setup-node, key = hash of the lock file; `cache-dependency-path` doesn't `cd`, it only says which file to hash.
- Mistake (R64): after the break, thought the cache copies old `node_modules` (no install). It is `~/.npm` downloads; `npm ci` always installs fresh, the cache just skips downloading. A bare `cache-dependency-path: package.json` → file not in repo root → step fails.
- Experiment: commented out `cache: npm` → green without the path (setup-node only installs Node). Fixed with `cache-dependency-path: 07-ci-cd/api/package-lock.json` (2026-11-12).
- Timing: `npm ci` without cache (1ea81d8) vs with cache (this run): _fill in_.
### Step 4
- Mistake (R65): Predict said the build fails without the `ca` secret. Secret mounts are optional by default → no file, build continues (Node only warns about the missing extra CA). `required=true` makes it mandatory. Correct part: the proxy problem is only on my PC, the runner needs no CA.
- Job `build`: `needs: test`, own fresh VM → checkout again, `setup-buildx-action`, `build-push-action` with `context: 07-ci-cd/api` (full path, `uses:` ignores working-directory), `push: false`. Green.
- Checkpoint (partly): "waits for test" ✓. Missing: build only runs if test PASSED (red test → build skipped); without `needs` jobs run in PARALLEL → image built (later pushed) even with failing tests. (Test job doesn't build anything, only lint + test.)
- Mini break-it ✔: test green, build red at `[build 5/5] RUN npm run build`: `Could not find tsconfig.json`. Checked ci.yml first (fine), then read the log → which Dockerfile line, then went through the lines above it → `COPY . .` missing (only package*.json copied). Put it back after `npm ci` (keeps the deps layer cached). Lesson: the test job runs on the checked-out repo, the build runs on what the Dockerfile COPIES → green tests don't prove the image builds.
### Step 5
- Predict ✓: sha tag = roll back to a known version fast. Plus: `latest` MOVES (overwritten every push), a sha never changes and points at the exact commit inside the image.
- Job `build` now: `permissions: packages: write`, `docker/login-action` with `GITHUB_TOKEN`, push tags `ghcr.io/tazo-taz/devops-api:<sha>` + `:latest`. Pulled it locally (package is private → `docker login ghcr.io` with a PAT `read:packages`).
- Checkpoint (partly → ✓): first "the commit before the current one". Not every commit has an image (`paths:` filter) and several may be pushed per day → pick the image that was RUNNING yesterday (tag list dates under Packages / deploy history), deploy it by sha, never `latest`.
- Mini break-it ✔: `IMAGE` had uppercase `devops-API` → build-push fails, no new package. Found it: image/repository names must be lowercase.
### Step 6
- Mistake (R66): Predict "idk" (branch pushes `latest`). Unreviewed code becomes `latest`, branches overwrite each other → only main + tags push.
- Workflow: `push` on all branches + tags `v*`; `build` has `if:` main or `refs/tags/v*`; `docker/metadata-action` makes the tags (full sha always, `latest` only on main, `1.0.0` from git tag `v1.0.0`).
- Tested: `test-branch` push → build skipped; tag `v1.0.0` on b82f937 → image `1.0.0` in GHCR.
- Checkpoint ✓: sha = exact commit (machines, rollback), version = set by hand with a git tag (humans, releases), latest = always newest from main (moves, never for prod).
- Mini break-it ✔: push to main, test green, build SKIPPED (no error!) → `if:` said `master`, branch is `main`. A false `if:` = skipped, not failed → easy to miss.
### Step 7
- Predict (half, R67): `ca` cert file ✓ (compose secret points at a file on my PC). 2nd guess "volume" ✗ (named volumes are auto-created) → it's `.env` (git-ignored, never checked out).
- `up` builds a missing image only if the service has `build:`; existing images need `--build` to rebuild. Tested: with `--no-build` compose doesn't need the `ca` file at all.
- `docker-compose.ci.yaml`: api + migrate use `image: ${API_IMAGE}` (= ghcr image of this sha). Job `smoke` (needs: build): login (packages: read) → `.env` from `secrets.DB_PASSWORD` → `up -d --no-build` → curl `localhost/api/users` with retries → logs on failure → `down -v` always.
- First run sat at "Waiting for a runner" ~5 min: GitHub-side queue, not our workflow. Then green: test → build → smoke.
- Checkpoint (partly, R68): "secrets aren't visible". Missing: committed `.env` = in git history forever; masking only hides the exact string (base64/partial leaks) and any workflow step can read a secret.
- Mini break-it ✔: smoke red "api never answered" → nginx `server api:3001`, api listens on 3000 → connection refused → 502 → `curl -f` fails every retry. Unit tests + image build were green: only the smoke test catches wiring between services.
- New rule (2026-11-12): after a break, Claude prints a spacer so the command scrolls off screen.
### Step 8
- Break 1 ✔ (failing test): `getHello()` returned `'Hello World'` → test red, build + smoke SKIPPED, no new image. Fixed the code (`!`). Why ✓: `needs: test` → build never starts; smoke `needs: build`. Good news = broken code never reached the registry.
### Step 9
### Step 10

---

## Summary
(written at the end)
