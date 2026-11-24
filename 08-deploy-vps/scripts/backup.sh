#!/usr/bin/env bash
# Daily Postgres backup: one gzipped SQL dump per run, keep the newest $KEEP.
# Runs on the server from cron. Usage: ~/app/scripts/backup.sh
set -euo pipefail # stop on any error, unset variable, or a failure INSIDE a pipe (pg_dump | gzip)

cd "$(dirname "$0")/.." # → ~/app, so `docker compose` finds the compose files + .env (COMPOSE_FILE)

BACKUP_DIR="${BACKUP_DIR:-$HOME/backups}" # outside ~/app: deploys never touch it
KEEP="${KEEP:-7}"
FILE="$BACKUP_DIR/app-$(date +%F_%H%M).sql.gz" # e.g. app-2026-11-24_0330.sql.gz → sorts by date

mkdir -p "$BACKUP_DIR"

# -T: no terminal (cron has none, and a tty would mangle the binary gzip stream)
# single quotes: $POSTGRES_USER/$POSTGRES_DB are expanded INSIDE the container (its own env), no password needed
docker compose exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB"' \
  | gzip > "$FILE.tmp"
mv "$FILE.tmp" "$FILE" # only a COMPLETE dump gets the real name (a crash halfway leaves only .tmp)

# rotation: newest first, skip the first $KEEP, delete the rest
ls -1t "$BACKUP_DIR"/app-*.sql.gz | tail -n +"$((KEEP + 1))" | xargs -r rm --

echo "$(date '+%F %T') backup OK: $FILE ($(du -h "$FILE" | cut -f1))"
