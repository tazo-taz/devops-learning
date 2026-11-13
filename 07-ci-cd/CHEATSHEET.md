# Cheat sheet — CI/CD with GitHub Actions

> My own answers, checked and corrected after the project.
>
> 🧪 = made-up scenario (didn't happen in our setup) · 📄 = about our real `.github/workflows/ci.yml` (line given, open it)

## Pipeline basics
1. A teammate says: "I always run the tests on my laptop before pushing, so CI is a waste of time." Give three things CI catches or guarantees that their laptop run doesn't.
   - those test are good for that environment not where docker is run, can miss run test but here is automatically he can run it but some other can forgot it, you mean it will test esact files what will be made as an iamge
2. A new teammate adds `07-ci-cd/api/.github/workflows/deploy.yml`, pushes, and nothing shows up in the Actions tab. No error anywhere. Why, and where must the file go?
   - it should be same level where .git is in devops
3. One run fails with `command not found` and exit code 127, another fails with exit code 1. What does each exit code tell you about what happened?
   - 127 is command not found which is that it exited before run, and exit 1 is runtime error

## npm in CI
4. The lock file was deleted by accident and `npm ci` goes red. A teammate "fixes" CI by changing the step to `npm install`, and it goes green. What's wrong with that fix, and what's the right one?
   - revert deleted lock file and issue is that it will download latest updates not exact ones which is in lock so it can have unexpected errors
5. setup-node with `cache: npm` fails with "Dependencies lock file is not found", but `07-ci-cd/api/package-lock.json` exists and `working-directory` points at `07-ci-cd/api`. Why does it fail? And what exactly is stored in that cache?
   - it should point at directly lock json, cache is not mandatory for lock file anything can be but we choose lock because it will be most accurate, if different cache it will go internet and will download everything, working directory is to cd and run "run commands"
     > 💡 Answer: working-directory part ✓. The cache is npm's DOWNLOAD folder `~/.npm` (package tarballs), NOT node_modules; the lock file's hash is the cache KEY. `npm ci` still installs everything, just without downloading again.
6. `lint` and `test` are green, but the Docker build in the `build` job fails with a TypeScript type error. How can lint be green if the code has a type error?
   - honestly i dont know hint me, lint checks ts errors right 
     > 💡 Answer: No: lint = ESLint (style + likely bugs like unused vars). Type errors come from the TypeScript compiler `tsc`, which runs in `nest build` = inside the Dockerfile, so only the `build` job sees them.

## Jobs and order
7. 🧪 (our `needs:` lines: ci.yml 31, 69) To "make CI faster" a teammate deletes `needs: test` from the `build` job. A week later there's a broken image in GHCR, and its run shows `test` red. Explain how that happened.
   - so dependance where removed so they all run parallel and test and lint might have errors but it still build and upload so it throw errors
8. 🧪 (real `if:`: ci.yml 33) You push to main. `test` is green, `build` shows **skipped** (grey, no error), and no new image appears. Where do you look first, and why is it "skipped" instead of "failed"?
   - we check build step, make sure there is correct if check in what case it skips build, skipped is gray and red means it run and it throw error 
9. A run goes red the instant you push, with no jobs listed at all. What kind of problem is this, and how do you find the exact spot?
   - yaml issue most likely so formatting, it tells you in github 
10. 🧪 we use GitHub's runners, not our own server (real cleanup step: ci.yml 115) On a self-hosted runner (your own server), the smoke test failed yesterday. Today every run fails at `docker compose up` with "port 80 already in use". What's missing in the workflow, and why didn't it run yesterday?
   - is port 80 in use we should docker compose down first, idk rest
   - still dont get it
     > 💡 Answer: The `docker compose down` cleanup step needs `if: always()`. Default is `if: success()`: yesterday a step failed, so every later step (the down) was SKIPPED, the containers kept running and still hold port 80.

## Registry and tags
11. Production broke after today's deploy. Which image do you deploy to go back to yesterday's version, how do you find its tag, and why not `latest`?
   - so in github there is version of this docker and below latest we should choose
   - so latest is what we have now, i am talking about tags i am saying if we have yesterdays version we should get commit sha from versions and set that one
12. In the `build` job the `docker/login-action` step is green, but the push at the end fails with `denied`. Login worked, so what's missing, and what's the difference between the two?
   - we should give it write permission to update docker, login will auth you and permission will allow what kind of actions you can do
13. 🧪 our CI does NOT do this (what prevents it: ci.yml 33) Every branch push builds and pushes `:latest`. Two teammates work on two feature branches. What goes wrong, and which part of our workflow prevents it?
   - idk what you are saying
   - ok so i think because there is tag already first one will work and second wont do the job, but also latest is overridden so idk
     > 💡 Answer: Both push the same `:latest`, so whoever pushed LAST wins and `latest` = unreviewed branch code (anyone pulling/deploying `latest` gets it). Branches don't block each other, they overwrite. Our fix: the build job's `if: github.ref == 'refs/heads/main' || startsWith(github.ref, 'refs/tags/v')` → branches only run tests, never push.
14. 📄 (tag rules: ci.yml 55–59) You run `git tag v2.1.0` and `git push origin v2.1.0` on main's newest commit. Which image tags does our workflow create? What would changing to `v3.0.0` signal to the people using the image?
   - v* does create new image so if we do v3 it means whole new release version so easily can be rollback instead of checking commits ids, so it will create one image but applies two tags, version and second latest when new one will be generated latest will change
     > 💡 Answer: Two tags on one image: `<full commit sha>` and `2.1.0` (no `v`). NOT `latest`: `enable={{is_default_branch}}` is false on a tag push (latest came from the main push of that commit). `v3.0.0` = MAJOR bump = breaking changes, users must check before upgrading.

## Secrets and smoke test
15. A teammate can't tell if `DB_PASSWORD` is correct in CI, so they add `echo $DB_PASSWORD | base64` "just to check". The log is masked anyway, so what's the problem? And why not just commit `.env` so CI has it?
   - having .env means that it will leak our data to whoever has access to our repo, so if we mastking secrets what would be the point of having .env in repo it will expose everything, so masking wont show us real env
     > 💡 Answer: `.env` ✓ (and it stays in git history forever). Masking only hides the EXACT secret string. `base64` prints a different string, so it shows in the log unmasked and anyone with log access decodes it back.
16. 📄 (smoke job: ci.yml 68+) Why does the `smoke` job **pull the pushed image by sha** instead of running `docker compose up --build` on the checked-out code? Name the reason that matters most and one more.
   - we want exact image which were created in meantime new something can be updated which miss match our build and in registry version so it is best practise to actually use one which was created 
   - having same image testing which is in production
     > 💡 Answer: "Same image as production" = the main reason again. One more: it also proves the push to GHCR and the pull (login, permissions, tag) really work; and it's faster, no second build.

## Review from earlier projects
17. (R1) To pin production to one exact image you write `image: ghcr.io/tazo-taz/devops-api:sha256:4f1c...` and compose says "invalid reference format". What's wrong, and what do `:` and `@` each mean in an image reference?
   - no idea
     > 💡 Answer: `:` = TAG (a name, can move), `@` = DIGEST (content hash, never changes). A digest needs `@`: `ghcr.io/tazo-taz/devops-api@sha256:4f1c...`. The `:` before `sha256` makes it an invalid tag.
18. (R14) Before pushing, you want to be sure your local `07-ci-cd/.env` will never be committed. Which git command tells you **whether** it's ignored and **by which line** of which `.gitignore`?
   - forgot command 
     > 💡 Answer: `git check-ignore -v 07-ci-cd/.env` → prints `.gitignore:line:pattern  file`; no output = NOT ignored.
19. (R8) You pulled the CI image and started it as container `smoke-api`. Now `docker tag smoke-api ghcr.io/tazo-taz/devops-api:mine` fails. Why, and what would you run instead?
   - did we pull mine or latest and thats why
     > 💡 Answer: `smoke-api` is a CONTAINER; `docker tag` only works on IMAGES. Tag the image: `docker tag ghcr.io/tazo-taz/devops-api:<sha> ghcr.io/tazo-taz/devops-api:mine` (find it with `docker images`).
20. (R11) In the smoke `.env` someone writes `DB_PASS=...` instead of `DB_PASSWORD=...`. What happens when the stack starts, and which command shows the env vars a running container really got?
   - it will set as a undefined and in nest it will throw error, printenv?

## Commands I used
| Command | What it does |
|---|---|
| `echo $?` | idk |
| `npm ci` vs `npm install` | 1. install with lock file generate new lock file by updating |
| `git restore package-lock.json` | undelete from current changes |
| `docker login ghcr.io -u tazo-taz` | login with that username |
| `docker pull ghcr.io/tazo-taz/devops-api:<sha>` | pull from tazo-taz devops-api repo with that sha |
| `git log -1 --format=%H` | forgot this H |
| `git switch -c test-branch` | create and or checkout |
| `git tag v1.0.0` + `git push origin v1.0.0` | generate new tag and push |
| `git push origin --delete test-branch` | delete in remote this branch |
| `docker compose up -d --no-build` | do not build here just download from registry |
| `curl -fsS http://localhost/api/users` | idk |
| `docker compose down -v` | remove volumes also |
| `docker image prune` | remove unused iamges |

> 💡 Answer: `echo $?` = exit code of the last command (0 = ok, 1 = failed, 127 = not found).

> 💡 Answer: `%H` = the FULL commit hash of the newest commit = the image tag our CI pushes.

> 💡 Answer: `curl -fsS` = `-f` exits non-zero on HTTP 4xx/5xx (plain curl exits 0 even on a 500), so the smoke step goes red; `-s` no progress bar, `-S` still print errors.

> 💡 Answer: `image prune` = only DANGLING `<none>` images (lost their tag after a rebuild). `-a` = all images no container uses.
