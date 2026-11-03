# Cheat sheet — Production-ready images

> My own answers, checked and corrected after the project. (`✅ Answer (Claude)` = ones I couldn't answer myself → review these.)

## Image size
1. Your api image is 2 GB. Which command shows WHERE the size comes from, and what were the two biggest parts of the project 3 image?
   - i meant docker history image name and it shows all, if we are using new node alpine version then node modules take most space 
2. You switch `FROM node:24` → `node:24-alpine`. What got removed, and name two things that can break or behave differently on alpine.
   - by switching to alpin version we minfied the utilities which were provided by node:24, and now we have only tools that needs to run this node project, also it removed curl and other debian built in packages which were not necessary to have project running
   - also there is not bash or something and we should use sh only

## Multi-stage builds
3. A teammate's final stage has `COPY dist ./dist`, and the build fails with "dist: not found" even though `npm run build` worked in stage 1. Why, and what's the fix?
   - from=build, without from it does not know that it should copy from prev stage and it will try to get it from current code which there is no dist and it will throw error or somethig or have old dist somehow if missed something
4. `typescript` and `@nestjs/cli` were installed in stage 1. Give two reasons why they're NOT in the final image.
   - because they need only dev env not on prod, we do not need ts compiling when we run node dist/main.js also it reduces size of node modules by removing unnecessary packages, when build happens and stage 2 started stage 1 is destroyed
5. Someone forgets `--omit=dev` in the final stage. Does the app still work? What changes?
   - აპლიკაცია უპრობლემოდ დაისტარტება, მაგრამ როდესაც პროექტი დიდია იმ ბიბლიოთეკების არ დაინსტალირებით რომლების საჭირო არ არის რომ საბოლოო ბილდი გაიშვას, ადგილს შევამცირებთ შესაბამისად ხარჯიც დაიკლებს
6. In the build stage someone wrote `CMD ["npm", "run", "build"]` instead of `RUN npm run build`. What happens when you build the image, and why?
   - მხოლოდ იმ შემთხვევაში ვწერთ CMD ... რომელი ბრძანებაც გვინდა კონტეინერის დასტარტვის შემდეგ გაეშვას რახან ჩვენ გვჭირდება ბილდ საქაღალდე რათა შემდგომ მეორე სთეიჯზე გადავიდეთ მაშინ ორ სთეიჯად ვერ გავუშვებთ რადგან თუ კონტეინერის დაწყების შემდეგ გვინდა გავუშვათ ბილდი შესაბამისად omit=dev-ს ვეღარ გავუშვებთ რადგან ბილდისთვის dev ბიბლიოთეკებიც გვჭირდება

## PID 1 and shutdown
7. `docker compose stop api` takes about 10 seconds and the container shows `Exited (137)`. What does 137 mean, why did it happen, and what are two ways to fix it?
   - ეს ნიშნავს რომ კონტეინერი გაითიშა ისე რომ არ მომხდარა პროცესის მიერ ამის გაანალიზება და შესაბამისი მოქმედებიბის განხორციელება, ამის თავიდან ასაცილებლად ჩვენ უნდა გვქონდეს graceful shutdown და დავხუროთ ყველა ისე კავშირი რომლებიც ჩვენ პროექტს აქვს დაწყებული, ასევე უნდა გამოვიყენოთ node dist/main.js, 9 error code, when node started this it should have listened on sigterm so when  it does not listen it forcefully shuts it, fix is enableShutdown() in main.ts
     > ✅ Answer (Claude): 137 = 128 + 9 = SIGKILL. `docker stop` sent SIGTERM, node (PID 1) had no handler, so it ignored it. Docker waited 10 s, then killed it hard (no cleanup). Fix 1: `app.enableShutdownHooks()` in `main.ts`. Fix 2 (no code): `init: true` in compose, so a tiny init (tini) becomes PID 1 and forwards the signal to node.
8. `CMD node dist/main` vs `CMD ["node", "dist/main"]`: which process is PID 1 in each case, and why does it matter?
   - still not understand what you mean here
     > ✅ Answer (Claude): Shell form `CMD node dist/main` → Docker runs `/bin/sh -c "node dist/main"`: PID 1 = sh, node = its child. `docker stop` sends SIGTERM only to PID 1; sh doesn't pass it on → node never hears it → killed after 10 s (137). Exec form `CMD ["node", "dist/main"]` → no shell, node IS PID 1 and gets SIGTERM directly.

## Non-root user
9. After a deploy the api logs `EACCES: permission denied, open 'uploads/avatar.png'`. Which Docker commands prove the cause WITHOUT opening the Dockerfile, and how do you fix it?
   - so we should add chrown node:node on that user something like this command before node user is applied because after that it is already user permission , command dont remember you car read and it says permission not allowed, there was docker compose exec something and return file acess and folder belongs to root and we can access by adding chrown to user
     > ✅ Answer (Claude): `docker compose exec api id` (or `run --rm api id` if it's crash-looping) → `uid=1000(node)`. `docker compose exec api ls -ld /app/uploads` → `root root drwxr-xr-x`. node isn't the owner → can't write. Fix: `RUN mkdir /app/uploads && chown node:node /app/uploads` BEFORE `USER node`.
10. A teammate puts `RUN chown node:node /app/uploads` AFTER `USER node`. What happens, and why?
   - after user node means that build will fail because only root can run this kind of command and after node user it will restrict all commands after that and only still root will be enable to change, roos is allow to change owner
11. Why is it a GOOD thing that `node` can't write to `/app` (where `dist/` lives)?
   - თუ მოხდა ისეთი რამ რომ სხვამ შეაღწია შვენ კონტეინერში არ ქონდეს წვდომა ფაილების წაშლა და შეცვლაზე

## Healthchecks and startup order
12. `docker compose ps` shows the api `(unhealthy)`, but `curl localhost:3000/health` from your PC returns 200. Which two `docker inspect` checks do you run, and what could the cause be?
   - /health შესაძლოა 200 სტატუს კოდს აბრუნებდეს მაგრამა არ ნიშნავს რომ დოკერის ფაილი ამას სწორად კითხულობს და შესაბამისად მის მიხედვით გამოაქვს კონტეინერის სტატუსი, ჩვენ უნდა ვნახოთ დოკერ ფაილი და healthcheck როგორ მუშაობს უნდა შევამოწმოთ დიდი ალბათობით აქ იქნება პრობლემა
      docker inspect <image or container name> --format '{{json .State.Health}}'
      > ✅ Answer (Claude): `docker inspect <container> --format '{{json .State.Health}}'` → the last results: exit codes + output of each check. `docker inspect <container> --format '{{json .Config.Healthcheck}}'` → the test command that is REALLY configured (compose may override the Dockerfile one). Cause in Break 2: the compose healthcheck called port 3001 instead of 3000.
13. You stop Postgres. What happens to the api's health status, and does Docker restart the api? Who actually acts on "unhealthy" in the real world?
   - so api will continue but it will be unhealth, dont understand who acts on unhealth, so we have running container but it is not healthy so devops should check logs and so on to inspect what is issue, got it when it is unhealthy lb redirects all trafic to other and kub restarts it
14. Why does the api healthcheck call `/health` (which runs `SELECT 1`) and not just `/`? Use the words liveness and readiness.
   - we have separate endpint to check if servcies this container uses are working fine, we might have different response on "/" this endpoint and if you mean check every endpoint it would be slow and also cost some money.
   / will return simple hello world and health returns not healthy 
15. You set a `healthcheck:` in compose AND a `HEALTHCHECK` in the Dockerfile. Which one runs?
   - so if there is in compose compose overrieds dockerfile, otherwise dockerfile runs

## Debugging
16. The api is `Restarting (1)` in a loop and `docker compose exec api sh` doesn't work. How do you get a shell to look at the files inside the image?
   - we have restart: unless-stopped which means if not starting then it will restart we either comment this command which is not best way better practise is to run docker compose run -rf or something similar which means separately run this container and when stop this in terminal destroy then

## Review from earlier projects
17. A deploy script runs `docker run -d --name worker my-worker` every time it deploys. The second deploy fails. What's the error about, and what are two ways to make the script work every time? (R2)
   - so we need "." in the end and also names should be unique or we should remove old and create new
      > ✅ Answer (Claude): Error: `Conflict. The container name "/worker" is already in use`: the old container from the last deploy still has that name (even if stopped). Fix 1: remove it first: `docker rm -f worker` then `docker run ...`. Fix 2: don't use a fixed name (Docker gives a random one), or use Compose, which replaces the container for you.
18. You type `docker biuld -t api .` and get `unknown shorthand flag: 't' in -t`. Docker complains about `-t`; what's actually wrong? (R3)
   - biuld?
19. When the DB is down, `/health` returns 503. Why 503, and not 400 or 500? (R4)
   - service unavaialble when checked such as pg
      400 means user send somethign which is bad, 500 is node service is unavaialable but 503 means internal something is unavaialble
      > ✅ Answer (Claude): 400 = the client sent something wrong (their fault). 500 = something unexpected broke in OUR code (a bug). 503 Service Unavailable = we're fine but a dependency (the DB) is down right now → temporary, try again later. Load balancers know 503 = "don't send traffic here".
20. In project 4 you copied `.env` over from project 3. How do you make sure git won't commit it, and what does it mean if the command prints nothing? (R14)
   - in git ignore i have .env,
   idk
      > ✅ Answer (Claude): `git check-ignore -v .env` → prints the `.gitignore` file + line number + rule that ignores it (e.g. `.gitignore:3:.env  .env`). No output = NOT ignored → git would commit it. Double-check with `git status`: `.env` must not appear.

## Commands I used
| Command | What it does |
|---|---|
| `docker history 04-prod-images-api` | checks layers with their sized of the container which where used to make container work → ✅ the layers of the IMAGE (each Dockerfile step) with their sizes |
| `docker image ls` | all images in local |
| `docker compose build api` | separatly only build api do not create or run container |
| `docker compose exec api ps` | is returns pid of processing running |
| `docker compose exec api id` | returns id of container → ✅ the uid/gid of the USER the process runs as (e.g. `uid=1000(node)`), not a container ID |
| `docker compose run --rm api sh` | create new container and open sh there when close destroy container |
| `docker inspect <c> --format '{{json .State.Health}}'` | returns health of container right |
| `docker inspect <c> --format '{{json .Config.Healthcheck}}'` | returns command how container check whether it is healthy or not |
| `docker compose ps -a` (the `Exited (N)` column) | all containers of yaml file even if stoped |
| `docker compose up -d --force-recreate api` | running container make restart → ✅ deletes the old container and creates a NEW one (even if nothing changed), not a restart |
| `docker image prune` | delete images locally → ✅ only dangling `<none>` images (old builds with no tag); tagged images like `postgres:16` stay |
