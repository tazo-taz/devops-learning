# DevOps learning workspace

The user is learning DevOps toward a junior-level role. Each subfolder here is one learning project.

## Roadmap
- `ROADMAP.md` holds the full 10-project roadmap (NestJS + PostgreSQL, from Docker basics to Kubernetes) plus a progress table.
- When the user says "start with <project>", take its goal / "You learn" / "Done when" from `ROADMAP.md`; they don't need to paste it.
- Folders are named `NN-short-name` (e.g. `01-docker-basics`, `02-dockerize-nestjs`), with no spaces, so `cd` and scripts work without quotes. Planned names are in the progress table.
- Projects build on each other: one app grows from project 2 onward. When a project extends the previous one, start by copying the previous project's code into the new folder, so each folder stays a working snapshot.
- When a project is finished, update its row in the `ROADMAP.md` progress table (✅ + date) and mark the next one ⏳.
- Previous project's `PLAN.md` "Summary" and "Next topic suggestion" are useful context when starting the next one.

## Workflow for every project
When the user starts a project (from `ROADMAP.md` or a pasted description):
1. Create the project subfolder if needed, then write `PLAN.md` inside it (same format as `01-docker-basics/PLAN.md`: header with Goal / You learn / Done when checkboxes, numbered steps with ✅ checkpoints, a "Notes / lessons learned" section per step, and a final Summary): an implementation plan split into small numbered steps, each with a goal, the commands/concepts involved, and a checkpoint to verify.
2. Do NOT do everything at once. Go one step at a time together with the user:
   - explain the concept briefly (junior level, plain language),
   - let the user type/run the commands themselves when practical, or run them and explain the output,
   - check the result and wait for the user before moving to the next step.
3. Tick off steps in `PLAN.md` (`- [x]`) as they're completed, and add short notes on mistakes/lessons learned.
4. At the end, verify the project's "Done when" criteria and write a short summary/cheat sheet in the project folder.

## Environment notes
- Linux, Docker 29 installed, user can run `docker` without sudo.
- Node v22, npm 10, git 2.53 installed (checked 2026-10-29). Workspace is not a git repo yet.
- TWO Docker engines exist: `desktop-linux` context (Docker Desktop, the user's current/default context) and `default` context (native engine, /var/run/docker.sock).
- The `ms-*` stack (/home/tazo/Desktop/projects/ms) lived on the `default` (native) engine. On 2026-10-28 the native engine was disabled (`systemctl disable --now docker.service docker.socket`, not uninstalled; ms data kept but user said it's test data). Ports 8080/5432/6379 are now free. Re-enable: `sudo systemctl enable --now docker.service docker.socket`.
- User has passwordless sudo but prefers to run sudo/system-changing commands themselves (with `!`); give them the command instead of running it.
