#!/usr/bin/env bash
# After a file edit: format it, then lint it.
#   Claude Code: PostToolUse (Edit|Write) → exit 2 shows ESLint errors to Claude.
#   Cursor:      afterFileEdit             → format only (the event cannot report
#                back to the agent; ESLint runs in stop-check.sh instead).
set -uo pipefail

HOOK_INPUT=$(cat)
# shellcheck source=lib.sh
. "$(dirname "$0")/lib.sh"

file=$(printf '%s' "$HOOK_INPUT" | jq -r '.tool_input.file_path // .file_path // ""')
[ -z "$file" ] || [ ! -f "$file" ] && exit 0

root=$(project_root)
case "$file" in
  "$root"/*) ;;
  *) exit 0 ;; # outside the project (plans, scratchpad, …)
esac
case "$file" in
  */node_modules/* | */.next/* | */prisma/migrations/*) exit 0 ;;
esac
cd "$root" || exit 0

case "$file" in
  *.ts | *.tsx | *.js | *.jsx | *.mjs | *.mts | *.json | *.css | *.scss | *.md | *.yml | *.yaml)
    pnpm exec prettier --write --log-level warn "$file" >/dev/null 2>&1 || true
    ;;
esac

is_cursor && exit 0

case "$file" in
  *.ts | *.tsx | *.js | *.jsx | *.mjs | *.mts)
    if ! out=$(pnpm exec eslint --no-warn-ignored "$file" 2>&1); then
      echo "ESLint ($file):" >&2
      echo "$out" | tail -n 40 >&2
      exit 2
    fi
    ;;
esac
exit 0
