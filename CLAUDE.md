# DevOps learning workspace

The user is learning DevOps toward a junior-level role. Each subfolder here is one learning project.

## Roadmap
- `ROADMAP.md` holds the full 10-project roadmap (NestJS + PostgreSQL, from Docker basics to Kubernetes) plus a progress table.
- When the user says "start with <project>", take its goal / "You learn" / "Done when" from `ROADMAP.md`; they don't need to paste it.
- Folders are named `NN-short-name` (e.g. `01-docker-basics`, `02-dockerize-nestjs`), with no spaces, so `cd` and scripts work without quotes. Planned names are in the progress table.
- Projects build on each other: one app grows from project 2 onward. When a project extends the previous one, start by copying the previous project's code into the new folder, so each folder stays a working snapshot.
- When a project is finished, update its row in the `ROADMAP.md` progress table (✅ + date) and mark the next one ⏳.
- Previous project's `PLAN.md` "Summary" and "Next topic suggestion" are useful context when starting the next one.

## Learning method (why the workflow looks like this)
Based on learning research (retrieval practice, spacing, interleaving, elaboration) and how DevOps people actually train (break-fix labs):
- **Recall before reading**: the user tries to answer/predict first, then gets the explanation. Getting it wrong first and then corrected sticks better than reading the right answer.
- **Spacing + mixing**: old mistakes come back in later projects (via `REVIEW.md`), mixed with new topics, instead of being drilled once and forgotten.
- **Explain why**: checkpoints ask "why", not only "does it work".
- **Break it on purpose**: debugging a broken setup is the core DevOps skill and the most common interview topic.
- **Solo run**: doing the core flow once without notes is the real test.
Keep all of this light: one question, not a lecture. If the user doesn't know, that's fine, explain and move on.

## Mistake tracking (`REVIEW.md`)
- `REVIEW.md` at the workspace root = one log of every mistake/misconception across all projects (ID, topic, mistake, project, asked in, streak).
- Whenever the user hits a mistake (wrong command, wrong mental model, a cheat sheet answer that gets a 💡), add a `- Mistake:` note in that project's PLAN.md **and** a row in `REVIEW.md` (or reset the existing row's streak to 0 if it's the same mistake again).
- Before writing a new question anywhere (warm-up, cheat sheet), read `REVIEW.md` and the earlier `CHEATSHEET.md` files: don't repeat an old question word for word; re-ask open items as a new scenario, ideally using the current project's tools.
- When a review question is answered correctly: streak +1 and add the project to "Asked in". Streak 2 → move to "Mastered". Wrong → streak 0.

## Workflow for every project
When the user starts a project (from `ROADMAP.md` or a pasted description):
1. Create the project subfolder if needed, then write `PLAN.md` inside it (base format: `01-docker-basics/PLAN.md`: header with Goal / You learn / Done when checkboxes, numbered steps with ✅ checkpoints, a "Notes / lessons learned" section per step, and a final Summary): an implementation plan split into small numbered steps, each with a goal, the commands/concepts involved, and a checkpoint to verify. On top of that format:
   - **Step 0 — Warm-up**: 3 quick recall questions answered in chat (no notes): 1–2 from the previous project, 1–2 open items from `REVIEW.md`. Update `REVIEW.md` streaks from the answers.
   - Each step gets a `- 🤔 Predict:` line: one question the user answers before running anything (e.g. "what will `curl` return if postgres is stopped?").
   - Each ✅ checkpoint includes a "why" the user explains in their own words, not only "it works".
   - A **Break it** step near the end (take the scenarios from the project's "Break it" line in `ROADMAP.md`): Claude breaks something without saying what (or names only the symptom), the user debugs with the loop symptom → look (logs/ps/inspect) → guess → test → fix → explain. No hints for the first few minutes.
   - A **Solo run** step: the user does the project's core flow from scratch without notes; Claude only watches. Note what they had to look up → `REVIEW.md`.
2. Do NOT do everything at once. Go one step at a time together with the user:
   - ask the 🤔 Predict question first, then explain the concept briefly (junior level, plain language),
   - let the user type/run the commands themselves when practical, or run them and explain the output,
   - check the result and wait for the user before moving to the next step.
3. Tick off steps in `PLAN.md` (`- [x]`) as they're completed, and add short notes on mistakes/lessons learned (mistakes also go into `REVIEW.md`, see above).
4. At the end, verify the project's "Done when" criteria and write the Summary in `PLAN.md`.
5. Cheat sheet = a quiz the user answers, not notes Claude writes (format: `02-dockerize-nestjs/CHEATSHEET.md`):
   - When the user is ready for the cheat sheet, create `CHEATSHEET.md` with ~12–16 numbered questions grouped by topic (`##` sections), each followed by an empty `   - ` answer line, plus a "Commands I used" table with an empty "What it does" column. Base the questions on this project's steps and on the mistakes in the PLAN.md notes.
   - Prefer scenario questions ("X happened, why, how do you fix it?") over definitions ("what is X?").
   - Add a `## Review from earlier projects` section with 3–4 questions for open `REVIEW.md` items (oldest / lowest streak / not recently asked first), each tagged with its ID like `(R6)`. Record the project in the item's "Asked in" column.
   - The user writes the answers in the file. When they ask for a check, review it and put the feedback **directly in the file**, not in chat: under each wrong/incomplete answer add a line `     > 💡 Suggestion: ...` saying what to change or add (don't rewrite their answer). Correct answers get no comment. Judge the concept, not the wording: the user's own informal words are fine; a 💡 only for a wrong idea or a part of the question left unanswered, kept to one short line that hints rather than giving the full answer. In chat, only say how many need work. Every answer that needed a 💡 → new row (or streak reset) in `REVIEW.md`; correct review answers → streak +1.
   - When the user has fixed an answer, remove its suggestion line. When all are resolved, change the subtitle to "My own answers, checked and corrected after the project."

## Environment notes
- Linux, Docker 29 installed, user can run `docker` without sudo.
- Node v22, npm 10, git 2.53 installed (checked 2026-10-29). Workspace is not a git repo yet.
- TWO Docker engines exist: `desktop-linux` context (Docker Desktop, the user's current/default context) and `default` context (native engine, /var/run/docker.sock).
- The `ms-*` stack (/home/tazo/Desktop/projects/ms) lived on the `default` (native) engine. On 2026-10-28 the native engine was disabled (`systemctl disable --now docker.service docker.socket`, not uninstalled; ms data kept but user said it's test data). Ports 8080/5432/6379 are now free. Re-enable: `sudo systemctl enable --now docker.service docker.socket`.
- User has passwordless sudo but prefers to run sudo/system-changing commands themselves (with `!`); give them the command instead of running it.
