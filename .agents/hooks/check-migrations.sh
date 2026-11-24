#!/usr/bin/env bash
# Fails if an uncommitted or staged Prisma migration contains the bogus
# `ALTER TABLE "actors" ALTER COLUMN ... DROP DEFAULT` lines that Prisma 7
# generates for the GENERATED ALWAYS columns (see AGENTS.md, "Migrations").
# Used by the guard-bash Claude hook and by the husky pre-commit hook.
set -euo pipefail

root="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel)}"
cd "$root"

files=$(
  {
    git ls-files --others --exclude-standard -- 'prisma/migrations/*/migration.sql'
    git diff --name-only HEAD -- 'prisma/migrations/*/migration.sql'
    git diff --cached --name-only -- 'prisma/migrations/*/migration.sql'
  } | sort -u
)
[ -z "$files" ] && exit 0

# Generated columns: actors.displayName*, every *Normalized search column,
# case_files.memoryDeadlineDate (and its raw-SQL index). Prisma often emits the
# ALTER COLUMN as a continuation line, without the ALTER TABLE prefix.
bad=$(printf '%s\n' "$files" | xargs grep -HnE \
  'ALTER COLUMN "(displayName|[A-Za-z]*Normalized|memoryDeadlineDate)" DROP DEFAULT|DROP INDEX "case_files_memoryDeadlineDate_idx"' \
  2>/dev/null || true)
if [ -n "$bad" ]; then
  echo "❌ Bogus Prisma lines on generated columns / raw-SQL index:"
  echo "$bad"
  echo "→ Remove these lines from migration.sql, then rerun 'pnpm exec prisma migrate deploy'."
  exit 1
fi
exit 0
