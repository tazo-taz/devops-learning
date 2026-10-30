# DevOps roadmap — 10 projects (easy → hard)

Each project builds on the one before. All use **NestJS + PostgreSQL**, so in the end it's one real app that goes from laptop to production.

## Progress

| #  | Project                              | Level        | Folder                  | Status        |
|----|--------------------------------------|--------------|-------------------------|---------------|
| 1  | Docker basics (no code)              | Beginner     | `01-docker-basics/`     | ✅ 2026-10-29 |
| 2  | Dockerize a NestJS app               | Beginner     | `02-dockerize-nestjs/`  | ✅ 2026-10-30 |
| 3  | NestJS + Postgres with Docker Compose| Beginner     | `03-compose-postgres/`  | ✅ 2026-10-30 |
| 4  | Production-ready images              | Junior       | `04-prod-images/`       | ⏳ next       |
| 5  | Dev vs. prod environments            | Junior       | `05-dev-vs-prod/`       | ⬜            |
| 6  | Nginx reverse proxy + multiple services | Junior    | `06-nginx-proxy/`       | ⬜            |
| 7  | CI/CD with GitHub Actions            | → Mid        | `07-ci-cd/`             | ⬜            |
| 8  | Deploy to a real server              | → Mid        | `08-deploy-vps/`        | ⬜            |
| 9  | Monitoring and logging               | → Mid        | `09-monitoring/`        | ⬜            |
| 10 | Microservices + Kubernetes           | → Mid        | `10-k8s-microservices/` | ⬜            |

Folder names are planned; create each when the project starts.

## How every project is learned
1. **Warm-up**: 3 recall questions from the last project and `REVIEW.md`, without notes.
2. **Steps**: predict first, then run it, then explain *why* it worked.
3. **Break it**: something gets broken on purpose; I find it with symptom → look → guess → test → fix.
4. **Solo run**: the core flow from scratch, no notes.
5. **Cheat sheet**: questions on this project plus review questions from my old mistakes (`REVIEW.md`).

---

## Beginner

### 1. Docker basics (no code)
Run ready-made containers: nginx, postgres, redis. Practice `docker run`, `ps`, `logs`, `exec`, `stop`, `rm`, and `images`. Connect to Postgres inside a container with `psql`.
- **You learn:** what images and containers are, ports (`-p`), and environment variables (`-e`).
- **Done when:** you can open nginx in your browser at localhost:8080, and create a table in the containerized Postgres.

### 2. Dockerize a NestJS app
Create a simple NestJS API with one `/health` endpoint. Write a `Dockerfile` and a `.dockerignore`, then build and run it.
- **You learn:** Dockerfile instructions (`FROM`, `WORKDIR`, `COPY`, `RUN`, `CMD`) and layer caching.
- **Done when:** `docker run -p 3000:3000 my-api` works and `/health` responds.

### 3. NestJS + Postgres with Docker Compose
Build a modular NestJS app (a users module with TypeORM or Prisma) and run it with Postgres using `docker-compose.yml`.
- **You learn:** Compose, container networking (the app connects to the hostname `postgres`, not `localhost`), `.env` files, and volumes so data survives restarts.
- **Done when:** `docker compose up` starts everything, and your users are still there after `docker compose down` and `up` again.
- **Break it:** wrong `DB_HOST` (`localhost`), postgres stopped while the api runs, password changed in `.env` after the volume exists.

## Junior level

### 4. Production-ready images
Improve project 3 with multi-stage builds (one stage to build, one small stage to run), an alpine base image, a non-root user, and a `HEALTHCHECK`. Make the app wait until Postgres is healthy before starting (`depends_on` with `condition: service_healthy`).
- **You learn:** image size optimization and basic container security.
- **Done when:** your image shrinks from about 1 GB to under 200 MB.
- **Break it:** non-root user can't write to a folder, healthcheck that always fails, missing file in the final stage ("Cannot find module").

### 5. Dev vs. prod environments
Create separate setups: `docker-compose.dev.yml` with hot reload (bind mounts) and pgAdmin, and `docker-compose.prod.yml` with the optimized image. Run database migrations automatically on startup.
- **You learn:** bind mounts vs. volumes, compose overrides, and environment-specific config.
- **Done when:** you edit code and the dev container reloads instantly.
- **Break it:** bind mount hides `node_modules`, a failing migration on startup, the wrong override file used.

### 6. Nginx reverse proxy + multiple services
Add a second service (like a simple frontend or a second NestJS API) and put Nginx in front of everything: `/api` goes to NestJS, `/` goes to the frontend. Add Redis for caching.
- **You learn:** reverse proxies, routing, load balancing (run 2 copies of the API), and caching.
- **Done when:** everything is reachable through a single port 80.
- **Break it:** 502 Bad Gateway (wrong upstream name/port), a missing trailing slash in `proxy_pass`, Redis down.

## Toward mid-level

### 7. CI/CD with GitHub Actions
On every push: run lint and tests, build the Docker image, and push it to Docker Hub or GitHub Container Registry, tagged with the commit hash.
- **You learn:** pipelines, image registries, secrets in CI, and versioning.
- **Done when:** a `git push` automatically produces a new image in the registry.
- **Break it:** failing test blocks the pipeline, missing/expired registry secret, YAML indentation error.

### 8. Deploy to a real server
Rent a cheap VPS (Hetzner, DigitalOcean, around $5/month), install Docker, and deploy with Compose. Extend the pipeline so it SSHes in and deploys automatically. Add HTTPS with Let's Encrypt (via Certbot, or Caddy/Traefik), plus automatic daily Postgres backups with `pg_dump` and cron.
- **You learn:** Linux servers, SSH, firewalls, domains and SSL, backups, and zero-touch deployment.
- **Done when:** pushing to main updates your live site at https://yourdomain.com.
- **Break it:** firewall blocks port 443, the SSH key is missing in CI, the disk is full, restore a backup into an empty DB.

### 9. Monitoring and logging
Add Prometheus (metrics), Grafana (dashboards), and Loki (logs). Expose metrics from NestJS, and add exporters for Postgres and the server itself. Set up an alert, for example "API is down", sent to Telegram.
- **You learn:** observability, which is a skill interviewers love to ask about.
- **Done when:** you have a Grafana dashboard showing requests per second, errors, CPU, and DB connections.
- **Break it:** a target shows DOWN in Prometheus, a dashboard with no data, an alert that never fires.

### 10. Microservices + Kubernetes
Split your app into 2 or 3 NestJS services (for example users, orders, notifications) that communicate through RabbitMQ. Deploy them to Kubernetes locally with minikube or k3s, using Deployments, Services, ConfigMaps, Secrets, an Ingress, and a StatefulSet for Postgres. Try scaling a service to 3 replicas.
- **You learn:** the basics of Kubernetes, which most DevOps jobs ask for.
- **Done when:** `kubectl get pods` shows everything running and you can scale with one command.
- **Break it:** `CrashLoopBackOff`, `ImagePullBackOff`, a Service selector that matches no pods, a missing Secret.

---

## Tips
- Mistakes are welcome: each one goes into `REVIEW.md` and comes back as a question in a later cheat sheet, until I get it right twice.
- For extra break-fix practice between projects: [SadServers](https://sadservers.com) (Linux/Docker troubleshooting) and [KillerCoda](https://killercoda.com) (free browser labs, good before K8s).
- Put every project on GitHub with a good README. Projects 7–10 are what will get you interviews.
- Learn basic Linux commands alongside these (files, permissions, processes, networking). DevOps uses them all the time.
- Projects 1–6 should take a few weeks. Don't rush 8–10; they're where you'll learn the most.
