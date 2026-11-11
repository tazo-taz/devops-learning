# Cheat sheet — Nginx reverse proxy + multiple services

> My own answers, checked and corrected after the project. (`✅ Answer (Claude)` = ones I couldn't answer myself → review these.)

## Reverse proxy basics
1. A teammate wants to publish every service directly (`api` on 3000, `web` on 8080, pgAdmin on 5050) "because the proxy is just one more thing that can break". Give three things you lose without the single nginx entry point.
   - so nginx has many things such as routing, load balancing, rate limitting and many things that helps us to deploy prod ready services, plus they are secured because only nginx is the one which gets traffic
2. You open `localhost/` and get **403 Forbidden** instead of the page, but `localhost/missing` gives 404. What is different about those two paths from nginx's point of view?
   - 403 forbidden so when read html or something it does not have access to read it but file exists but 404 does not exits
   - dont remember which one 
     > ✅ Answer (Claude): `/` is a FOLDER that exists, so not 404. But there's no `index.html` (index file) in it, and directory listing (`autoindex`) is off, so nginx refuses to show the folder → 403. `/missing` doesn't exist at all → 404.
3. Your page at `http://localhost` calls `fetch('http://localhost:3000/users')`. The Network tab shows the request got a 200, but the Console shows a CORS error and the list is empty. Why, and how does going through nginx avoid it?
   - because they are on different ports it does need cors so when have nginx client sends to backend with same domain

## Routing + proxy_pass
4. Nginx has `location /api/ { proxy_pass http://api_backend; }` and Nest's routes are `/users`. A user calls `/api/users`. What path does Nest receive, what does the user get back, and what is the one-character fix?
   - so it should be backend/ because /api/users and /api/ only users is difference and it is appended on api backend but it need slash to work so it will be like api_backendusers? most likely it wont find that
   - so when service does not have / in the end it does not accept
     > ✅ Answer (Claude): No path after the host in `proxy_pass` → nginx passes the URL UNCHANGED → Nest gets `/api/users`, has no such route → 404 `Cannot GET /api/users`. Fix: add `/` → `proxy_pass http://api_backend/;` → `/api/` is replaced with `/` → Nest gets `/users`.
5. `curl localhost/api/users` returns 404. How can you tell from the response itself whether nginx or Nest produced it?
   - we can check nginx logs idk how but i know it exists second is if we have logs in nest it will logs something
     > ✅ Answer (Claude): Look at the BODY: Nest/Express answers with JSON `{"message":"Cannot GET /api/users","error":"Not Found","statusCode":404}`; nginx's own 404 is a small HTML page "404 Not Found / nginx". JSON = the request reached the api, only the path was wrong.
6. A teammate puts `try_files $uri $uri/ /index.html;` in the FRONT nginx (the one that proxies to `web`) and gets 500 with "internal redirection cycle" in the log. Why does it loop, and where should that line live instead?
   - so if we put in front it will checks index.html which does not exist so we should do location / and all traffic will be redirect to web nginx and add that try files into web nginx

## 502 / 504 / config reloads
7. Three cases, same request `/api/users`: (a) the api container is paused, (b) nginx points at `api:3001` but Nest listens on 3000, (c) the api container was removed. For each, what status code do you expect and roughly how fast? Why are they different?
   - if paused it will wat for 60s and returns 504 becuase it ip and all datas are here but wait to listen, if it was runnig immedietly 502 
     > ✅ Answer (Claude): (c) container removed = nobody at that IP anymore → ~3 s (no reply, `No route to host`) → 502. So: paused = connection accepted, no answer → waits `proxy_read_timeout` 60 s → 504; wrong port = alive but nothing listens → refused instantly → 502; removed = nobody there → a few seconds → 502.
8. You edit `nginx/default.conf` and run `docker compose up -d`. Nothing changes. Why not, and which two commands would you run instead (one to check, one to apply)?
   - need to restart because i think it is cached so it does not restart, or down and up things, 
     > ✅ Answer (Claude): Compose only recreates a container when its SERVICE DEFINITION in the yaml changes; the CONTENT of a mounted file isn't part of it → `up -d` sees nothing to do, nginx keeps the config it read at start. Instead: `docker compose exec nginx nginx -t` (check) → `docker compose exec nginx nginx -s reload` (apply, no downtime).
9. You scale the api from 1 to 2 copies with `--scale api=2`, but every request still goes to api-1. Nothing is broken. What did nginx do at startup that explains this, and what fixes it?
   - add up_stream to handle load balance also add 64kb memory to remember ordering cache and other tings, on startup it makes connections and all checks
     > ✅ Answer (Claude): Nginx looked up the name `api` ONCE at startup, when only api-1 existed → it remembered one IP and never asks DNS again. Fix: reload/restart nginx after scaling, so it resolves `api` again and gets both IPs (+ the upstream with `zone` for an even 1-2-1-2).

## Load balancing
10. With 2 api copies behind the upstream, you see `servedBy` go 1,1,1,1,1,1,1,2 instead of 1,2,1,2. Which line in the upstream fixes that, and what problem does it solve?
   - add memory on it so all 16workers have same memor
11. Without changing any api code, you want to see for every request which api copy answered and how long it took. Where do you look, and what do you add?
   - we add on nginx logging
     > ✅ Answer (Claude): The nginx ACCESS LOG (`docker compose logs nginx`). Add a custom `log_format` with `$upstream_addr` (which api copy, IP:port) and `$request_time` / `$upstream_response_time` (how long), and use it in `access_log`.
12. The api logs every client as `172.20.0.6` (nginx). Name two real reasons the api needs the visitor's IP, and how nginx passes it along.
   - we do not pass in header ip of what actually coming from client
     > ✅ Answer (Claude): Reasons: 1) logs/monitoring (who did what, debugging one user's problem), 2) security: rate limiting per IP, blocking an attacker, audit logs; without it every user looks like nginx → one limit hits everyone. Nginx passes it with `proxy_set_header X-Real-IP $remote_addr;` and `X-Forwarded-For $proxy_add_x_forwarded_for;`.

## Redis caching
13. Two api copies cache `GET /users`. Copy 1 caches the list; the next request goes to copy 2. HIT or MISS, and why? What would change if each copy cached in its own memory?
   - hit, because redis is outside of api so memory coming from centrilzed
     > ✅ Answer (Claude): Per-copy memory cache: copy 2 has its own empty cache → MISS, goes to the DB. Each copy caches at different times → they can return DIFFERENT data, and on a POST you'd have to clear the cache in EVERY copy (the DEL only reaches the one that got the POST). Shared Redis = one copy of the truth.
14. `/api/users` is always `X-Cache: MISS` but fast, and there are no errors in the api logs. Later, it is always MISS but takes several seconds. What is the difference between the two situations, and what do you check in each?
   - do we have logs actually if redis return good response it should tells us what is issue, or even check redis and test there
     > ✅ Answer (Claude): Fast MISS, no errors: Redis is up and answers instantly, but refuses writes (our case: `maxmemory 1` → OOM), and the silent `.catch` hides it → check by hand in `redis-cli`: `SET test 1` (→ OOM error), `CONFIG GET maxmemory`. Slow MISS: Redis is DOWN/unreachable → every request waits for ioredis reconnect attempts, then falls back to the DB → `docker compose ps -a` (redis exited), `logs redis` (SIGTERM / crash), api logs show `Redis read failed`.
15. A user adds their name and refreshes, but the list doesn't show them for up to a minute. Explain why, and what the code should do on every write.
   - need to clear cache

## Review from earlier projects
16. You want to look at nginx's config inside the container and run `docker compose exec nginx cd /etc/nginx/conf.d && ls`. What actually happens, and how do you write it correctly? (R21)
   - no need of cd just ls, ls is program thereo or sh -c and "..."
     > ✅ Answer (Claude): `exec` runs a PROGRAM; `cd` is a shell builtin, not a program → `executable file not found`. And `&& ls` isn't part of the exec at all: MY shell runs it on my PC after exec fails. Correct: `docker compose exec nginx ls /etc/nginx/conf.d` or `docker compose exec nginx sh -c 'cd /etc/nginx/conf.d && ls'`.
17. You add a `healthcheck:` to the `redis` service, but `docker compose up` says `did not find expected key`. The keys look right. What is the most likely mistake? (R23)
   - what key is this
     > ✅ Answer (Claude): Indentation. YAML decides the parent of a key by its indent: `healthcheck:` has to be at the SAME level as `image:` (inside `redis:`), and `test:`/`interval:` one level deeper. One space too many/few → "did not find expected key".
18. A teammate's Dockerfile for the `web` frontend has `CMD npm run build` followed by `COPY dist /usr/share/nginx/html`. The page is empty. What is wrong with using CMD there? (R25)
   - here should be run not cmd, cmd is after container is started
19. You add a healthcheck to the api that calls `GET /`. Postgres goes down, `/` still answers, and the container stays healthy. What should the healthcheck call instead, and why does it matter? (R26)
   - it should select 1 from pg and so on, connections to services which it sue

## Commands I used
| Command | What it does |
|---|---|
| `docker compose exec nginx nginx -t` | checks if format is good? |
| `docker compose exec nginx nginx -s reload` | when  change something to apply |
| `docker compose up -d --scale api=2` | run two api and others same |
| `docker compose exec api netstat -tln` | ports as i remember |
| `docker compose exec redis redis-cli` → `KEYS *`, `TTL users:all` | go into redis and list all keys and second is expierable or something, how many seconds or something or when |
| `curl -i localhost/api/users` | return response with headers |
| `docker pause <c>` / `docker unpause <c>` | do not delete ip and network just stop getting requests so all of them hangs until unpause |
| `docker network disconnect <net> <c>` | remove service from network |
| `docker compose ps -a` vs `docker ps` | all including exited services from current yaml and second is general outside of compose |
| `docker ps --format 'table {{.Names}}\t{{.Mounts}}'` | which mounts are there |
| `docker compose config --volumes` | what volumes compose uses |
