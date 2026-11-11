# Project 7 — CI/CD with GitHub Actions

**Goal:** On every push: run lint and tests, build the Docker image, and push it to a registry (GitHub Container Registry, `ghcr.io`), tagged with the commit hash.
**You learn:** pipelines, image registries, secrets in CI, and versioning.
**Done when:**
- [ ] a `git push` that touches `07-ci-cd/` automatically runs lint + tests and produces a new image `ghcr.io/tazo-taz/...:<commit sha>` in the registry
- [ ] a failing test stops the pipeline BEFORE any image is pushed
- [ ] (extra) CI starts the whole compose stack with the new image and `curl`s through nginx (smoke test), using CI secrets instead of a committed `.env`

> From project 6: nginx on port 80 in front of `web` + 2 api copies (`upstream` + `zone`), Redis cache, dev/prod compose overrides, one-shot `migrate`.
> Problem now: every check and build happens by hand on MY PC ("works on my machine"). Nobody stops a broken commit, and there is no stored, versioned image a server could pull (project 8 needs exactly that).
> Starting code = a copy of `06-nginx-proxy/` (without `node_modules`/`dist`/`uploads`, `.env` copied, still git-ignored).
> Monorepo detail: this whole workspace is ONE GitHub repo (`devops-learning`). GitHub only reads workflows from `.github/workflows/` at the REPO ROOT, so the workflow lives there and uses `paths:` + `working-directory:` to point at `07-ci-cd/`.
> Registry choice: GHCR, because it logs in with the built-in `GITHUB_TOKEN` (no extra account). Docker Hub works the same way with a username + access token secret.
> Method: Explain-it, not memorize. Looking up workflow syntax is fine; what matters is knowing WHAT exists and WHY.

Every step ends with 🔨 mini break-it(s): Claude quietly breaks one thing and gives only the symptom. Keep the files closed until you've looked (Actions tab logs, `git log`, `docker` tools).

---

## Step 0 — Warm-up (no notes)
- 3 recall questions in chat: 1 from project 6, 2 open `REVIEW.md` items. Update streaks.

## Step 1 — Be the pipeline by hand
- Concept: CI = a fresh machine runs the SAME commands I'd run (`npm ci`, `lint`, `test`, `docker build`) on every push. A step "fails" when its command exits non-zero (`echo $?`), and the pipeline stops there.
- 🤔 Predict: you run `npm ci && npm run lint && npm test && docker build ...` and the tests fail. Does the build run? Why does `&&` behave like a pipeline?
- Run lint, tests, build locally in `07-ci-cd/api`; read the exit codes. Fix whatever fails (find out WHY first: is the code wrong or the test?).
- [ ] ✅ Checkpoint: all three pass locally. Why: in your words, why is "it passes on my PC" not enough?
- 🔨 Mini break-it:

## Step 2 — First workflow: hello from GitHub
- Concept: workflow (`.github/workflows/*.yml`) → triggered by an event (`on: push`) → jobs (each on a fresh VM, `runs-on: ubuntu-latest`) → steps (`run:` a shell command or `uses:` a ready-made action). Actions tab = logs.
- 🤔 Predict: you put the workflow file in `07-ci-cd/.github/workflows/` and push. What happens in the Actions tab?
- Write a tiny workflow that prints `uname -a`, `docker --version`, `node --version`, `pwd`, `ls`. Push, watch it run. Add `paths: ['07-ci-cd/**']` so other folders don't trigger it.
- [ ] ✅ Checkpoint: green run in the Actions tab. Why: where does this code run, and what's on that machine when the job starts?
- 🔨 Mini break-it:

## Step 3 — Lint + test job
- Concept: `actions/checkout` (the VM starts EMPTY, no code), `actions/setup-node` (+ npm cache), `defaults.run.working-directory`, `npm ci` vs `npm install`.
- 🤔 Predict: you skip `actions/checkout` and run `npm ci`. What error do you get?
- Job `test`: checkout → setup-node 24 → `npm ci` → `npm run lint` → `npm test`.
- [ ] ✅ Checkpoint: green run, and the log shows the test count. Why: why `npm ci` and not `npm install` in CI?
- 🔨 Mini break-it:

## Step 4 — Build the image in CI
- Concept: `docker/setup-buildx-action` + `docker/build-push-action` (build only, `push: false`). The Dockerfile's `--mount=type=secret,id=ca`: the CI runner is NOT behind the corporate proxy.
- 🤔 Predict: the Dockerfile mounts the `ca` secret, but CI doesn't pass one. Does the build fail? (Hint: are secret mounts required by default?)
- Job `build` with `needs: test` (only runs if tests passed).
- [ ] ✅ Checkpoint: green build job after the test job. Why: what does `needs:` give you, and what would happen without it?
- 🔨 Mini break-it:

## Step 5 — Push to GHCR, tagged with the commit hash
- Concept: registry = a "GitHub for images" (`docker push` / `docker pull`). Full name `ghcr.io/<owner>/<image>:<tag>`. Login with `docker/login-action` + `GITHUB_TOKEN`; the job needs `permissions: packages: write`. Tags: `${{ github.sha }}` (exact, never changes) + `latest` (moves).
- 🤔 Predict: why tag with the commit sha at all, when `latest` already points at the newest image?
- Push the image, find it under the repo's Packages, `docker pull` it on my PC and run it.
- [ ] ✅ Checkpoint: the image in GHCR has the same sha as `git log -1`. Why: which image would you deploy to roll back to yesterday, and how do you find it?
- 🔨 Mini break-it:

## Step 6 — When to push: branches, PRs, versions
- Concept: `on: push` vs `pull_request`; `if: github.ref == 'refs/heads/main'` (PRs only test, main also pushes); git tag `v1.0.0` → image tag `1.0.0` (`docker/metadata-action`). Semver = MAJOR.MINOR.PATCH.
- 🤔 Predict: a PR from a branch builds and PUSHES `latest`. What could go wrong?
- [ ] ✅ Checkpoint: a push to a branch → tests only; push to main → image; tag `v1.0.0` → image `1.0.0`. Why: sha vs semver vs latest, who is each one for?
- 🔨 Mini break-it:

## Step 7 — Smoke test the stack in CI + secrets
- Concept: unit tests check functions; a smoke test starts the real stack (compose: nginx + api + postgres + redis) and `curl`s it. `.env` is git-ignored, so CI has no DB password → GitHub repo **secrets** (`${{ secrets.X }}`), masked as `***` in logs. Compose's `ca` secret file only exists on MY PC.
- 🤔 Predict: CI runs `docker compose up` with our compose file. Which TWO things from my PC are missing on the runner?
- Job `smoke`: create `.env` from secrets, start the stack with the built image, wait for health, `curl localhost/api/users`, `down`.
- [ ] ✅ Checkpoint: green smoke job; the password never appears in the log. Why: why not commit `.env`, and why not `echo` a secret to "debug" it?
- 🔨 Mini break-it:

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
