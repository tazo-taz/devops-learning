# Review log — my mistakes and weak spots

Every mistake from any project lands here: wrong commands, misconceptions, and cheat sheet answers that got a 💡.
Each new cheat sheet re-asks 3–4 open items in a **new form** (different scenario, not the same wording) in its "Review from earlier projects" section.

- **Streak** = how many later cheat sheets in a row I answered it correctly without help. Wrong answer → back to 0.
- Streak **2** → move the row to "Mastered".
- **Asked in** = the cheat sheets that already re-asked it, so the next one picks something else first (oldest / lowest streak first).

## Open

| ID  | Topic | The mistake / misconception | From | Asked in | Streak |
|-----|-------|-----------------------------|------|----------|--------|
| R1  | Image names | `nginx@alpine` → "invalid reference format". `:` = tag, `@` = digest (`@sha256:...`). | P01 | P03 | 0 |
| R2  | Container names | Reused `--name web` → "Conflict". Names must be unique; checked before create, nothing to clean up. | P01 | | 0 |
| R3  | Reading errors | `docker un` → "unknown shorthand flag: 'd'". The error shows where the program got confused, not where I typed wrong → check typos first. | P01 | | 0 |
| R4  | HTTP status codes | 4xx = client's mistake, 5xx = server bug. Duplicate email should be 409, not 500. | P01, P03 | | 0 |
| R5  | Build context | `docker build -t my-api` without `.` → "requires 1 argument". The `.` = folder `COPY` can see. | P02 | | 0 |
| R6  | Stale code | Forgot `RUN npm run build` → image shipped my PC's old `dist/`. "It works" ≠ "it's correct". | P02 | P03 | 0 |
| R7  | Dockerfile vs shell | Pasted `RUN ...` into bash → "command not found". Dockerfile instructions only live in the Dockerfile. | P02 | P03 | 1 |
| R8  | Image vs container | `docker tag api ...` failed: `api` = container. Tags are for images (`docker images` vs `docker ps`). | P02 | P03 | 0 |
| R9  | Flags vs names | `docker compose up -d build` → "no such service: build". A word without `--` = service name. | P03 | P03 | 0 |
| R10 | Unsaved file | Edited the YAML but didn't save → experiment showed the old result. Verify the file / `compose ps`. | P03 | | 0 |
| R11 | Env var names | `DB_DB` vs `DB_NAME` → worked by luck (`pg` default). Check with `docker compose exec api printenv`. | P03 | P03 | 0 |
| R12 | Rebuild needed? | `up -d` reuses the old image after code changes → `up -d --build`. Env/port change → only recreate. | P03 | P03 | 0 |
| R13 | Volume names | Thought `pgdata` was named because it's Postgres. I named it in the YAML; Compose adds the project (folder) name in front. Hash name = anonymous volume. | P03 | | 0 |
| R14 | `.env` + git | Didn't know `git check-ignore -v .env` (asks which `.gitignore` line ignores it, no output = not ignored). Compose auto-reads `.env` next to the YAML. | P03 | | 0 |
| R15 | Proxy CA in compose | Forgot: `build.secrets: [ca]` uses + top-level `secrets: ca: file:` defines; Bake blocks files outside the project → `BUILDX_BAKE_ENTITLEMENTS_FS=0`. | P03 | | 0 |
| R16 | psql | `user` is reserved → `"user"` in quotes. `psql -d` = database, not password. | P03 | | 0 |

## Mastered

| ID | Topic | Mastered in |
|----|-------|-------------|
