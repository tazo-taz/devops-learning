# Cheat sheet — Dev vs. prod environments

> My own answers, checked and corrected after the project. (`✅ Answer (Claude)` = ones I couldn't answer myself → review these.)

## Bind mounts vs. volumes
1. You put Postgres data in a bind mount `./pgdata:/var/lib/postgresql/data` instead of a named volume. It works. Name one reason teams still prefer a named volume for DB data, and one case where a bind mount is the right choice.
   - when we create bind mount it will create folder in our project folder which we dont need, having this as a volume it will create somewhere and we dont need to see, also one is for when we create volume based, bind choice maybe when we easily want to delete data or copy from old pg data and paste here
2. A teammate mounts `./api:/app` on a running container with `docker run`… and it isn't there. They try to "add the mount" to the existing container. Why can't they, and what do they have to do instead?
   - so first we should down container, add mounts in yaml file and then start the container and it will work, add mount wont work on running container i think
3. On your PC you delete `api/node_modules` completely. Does the dev container still start? Why / why not?
   - yes because we have anonymouse volume for it which prevents nececity of having node moudles in our folder

## Dev stage + hot reload
4. Someone writes the dev stage as `FROM node:24-alpine` + `CMD ["npm", "run", "start:dev"]` (nothing else). It builds fine. What happens when the container starts, and why?
   - there wont be build files because we are deleting old folders
     > ✅ Answer (Claude): That image is empty Node: no WORKDIR, no `package.json`, no `npm ci`. `npm run start:dev` runs in `/` → `Could not read package.json` (ENOENT). Even with the bind mount, the `node_modules` volume gets filled from the image's EMPTY folder → `nest: not found`. `FROM build` brings the code, deps and WORKDIR.
5. You save a file, but the dev api doesn't reload. List the things you'd check, in the order you'd check them (no syntax needed, just what and why).
   - most likely it is bound issue, second one might be we are running as a prod env not dev
     > ✅ Answer (Claude): Cheapest first: 1) is the file really saved? (R10) 2) `logs api`: is watch mode running, did it print "File change detected"? 3) is it really dev: `start:dev`, label `config_files` = base + dev 4) `inspect .Mounts`: is `./api` bound to `/app`?
6. Why don't we use hot reload (bind mount + `start:dev`) in prod as well? Give two reasons.
   - it downloades all packages which is massive so we spare some space of htis, second might be no need of having hot reload because we wont change it by hand

## Compose overrides
7. Base file says `ports: ["3000:3000"]` for the api, dev override says `ports: ["9229:9229"]`. After merging, which ports are published? And if base has `image: a` and the override `image: b`, which wins? (What's the general rule?)
   - overried always works
     > ✅ Answer (Claude): Lists MERGE, single values get REPLACED. `ports` = 3000 AND 9229 both published. `image: b` wins (the later file wins for single values).
8. You run `docker compose up -d` and get the prod api, but you wanted dev. Name two places where Compose decides which files to read, and the one-command way to see what it REALLY ended up with.
   - one is in yaml file having target: dev second one is inline target dev, -f docker-compose.dev.yaml
     > ✅ Answer (Claude): Files come from 1) `-f` flags in the command, 2) `COMPOSE_FILE` in `.env` (and with neither: `compose.yaml` + `compose.override.yaml`). `docker compose config` prints the final merged result.
9. Why split into base + dev + prod files at all, instead of two full copies `docker-compose.dev.yaml` and `docker-compose.prod.yaml`?
   - when there is mutual things in two files it is much better to coming from similar to layers because in future when we change dev we might forget prod

## Migrations
10. Why is `synchronize: true` dangerous in prod, even though it's so convenient in dev?
   - it will delete columns if there is conflict with new migration, current entity model 
11. The api starts before the migration finished and crashes with `relation "user" does not exist`. What should the startup order look like, and which Compose feature makes the api wait?
   - api should be depend on migration service ready, so for postgress it  should be depens on service health which is like interval running and for migration it is service completed successfully which means it exited 0
12. A migration already ran on staging, then you notice a typo in its column name. Do you edit the migration file? Why / why not, and what do you do instead?
   - should create new migration because in db we already saved that so wont re run

## Environment config
13. A teammate bakes `DB_PASSWORD=supersecret` into the image with `ENV` in the Dockerfile "so prod just works". Give two problems with that, and where the value should come from instead.
   - secrets should be coming from docker secrets because we can not read them if we need so it is much secure
     > ✅ Answer (Claude): 1) Anyone who can pull the image can read it (`docker inspect` / `docker history`), and it sits in the registry forever. 2) One image = one password for every environment; changing it = rebuild. → Pass it at RUNTIME: `.env` / `env_file`, Docker secrets, or a secret manager.
14. Later (project 7) CI builds ONE prod image, and the exact same image runs on staging and on prod. What's different between staging and prod then, if not the image? Name three things.
   - staging is like dev for us only but dev environment so we can test it it all good, env files, other services which this one is depends on and also if there is some volume we need and we forgot 

## Review from earlier projects
15. The api returns 500 after a migration change. A teammate immediately says "it's the DB connection, restart Postgres". What do you do first, and why? (R17)
   - first i would check api logs then pg logs to check issue and based on that i would investigate
16. In the prod stage someone writes `COPY ./dist ./dist`. The build works on their PC but the image runs code from last week. Explain what got copied and from where. (R18)
   - he missed --stage = build or similar thing you are talking about? without from build there should not be any dist or if it is it will be old build dist folder which we dont want
     > ✅ Answer (Claude): Without `--from`, COPY reads from the build CONTEXT = the `api/` folder on their PC, not stage 1. So it copied their local `dist/` from their last `npm run build` (last week), not the fresh one built in stage 1. Fix: `COPY --from=build /app/dist ./dist`.
17. The prod image needs a `logs/` folder the app writes to. A teammate adds `RUN mkdir /app/logs` after `USER node` and the build fails. Why, and how do you order it? (R22)
   - user node should be last because after we apply this we lose root permissions and by default we can only read files, so user node should be last so root creates folder and then makes user, but also if we want to write there we also need to add chrown or similar command forgot which gives access to user node, but chrown should be before user node
18. Your api has `depends_on: [postgres]` (short form). It still fails at startup with `ECONNREFUSED` now and then. Why, and what's the fix? (R24)
   - depends on postgres healthy i think

## Commands I used
| Command | What it does |
|---|---|
| `docker run --rm -v "$PWD/empty:/app" <image>` | it binds empty folder to our project with certain image |
| `docker inspect <c> --format '{{json .Mounts}}'` | logs what mounts it has  |
| `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml up -d` | run dev target yaml enf |
| `docker compose config` | config of all services running and so on → ✅ prints the final MERGED config from the yaml files (+ `.env` values filled in) |
| `docker compose up -d -V` | start with new volumes and so on → ✅ recreates only ANONYMOUS volumes (fresh `node_modules` from the image); named ones like pgdata are kept |
| `docker compose down -v` | remove volume as well |
| `docker compose exec api npm run migration:generate -- src/migrations/X` | run this command in api service → ✅ compares the entities with the real DB and WRITES a new migration file with the SQL |
| `docker compose run --rm migrate` | run new migrate service when we stop terminal it will be removed |
| `docker compose ps -a` | show all even stops services  |
| `docker image prune` | remove images that not running → ✅ removes only dangling `<none>` images (old untagged builds); `-a` = all images no container uses |
