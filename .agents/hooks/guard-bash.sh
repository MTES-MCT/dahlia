#!/usr/bin/env bash
# Shell guard: blocks secret leaks and unsafe Prisma migrations.
#   Claude Code: PreToolUse (Bash)       → exit 2 + stderr to block.
#   Cursor:      beforeShellExecution     → JSON {"permission": "deny", ...}.
set -euo pipefail

HOOK_INPUT=$(cat)
# shellcheck source=lib.sh
. "$(dirname "$0")/lib.sh"

cmd=$(printf '%s' "$HOOK_INPUT" | jq -r '.tool_input.command // .command // ""')

allow() {
  is_cursor && echo '{"permission": "allow"}'
  exit 0
}
block() {
  if is_cursor; then
    jq -n --arg m "⛔ guard-bash: $1" '{permission: "deny", user_message: $m, agent_message: $m}'
    exit 0
  fi
  echo "⛔ guard-bash: $1" >&2
  exit 2
}

[ -z "$cmd" ] && allow

# 1. Never touch real env files (".env.example" is allowed).
if printf '%s' "$cmd" | grep -Eq '(^|[^A-Za-z0-9_.-])\.env(\.[A-Za-z]+)?([^A-Za-z0-9_.-]|$)' &&
  ! printf '%s' "$cmd" | grep -Eq '\.env\.example'; then
  block "access to .env and db files is forbidden (secrets). Use .env.example to know the variable names."
fi

# 2. Personal data exports must not be read from the shell either.
if printf '%s' "$cmd" | grep -Eq '(^|[^A-Za-z0-9_.-])(\./)?(tmp|webapp_dbdata)(/|[^A-Za-z0-9_.-]|$)'; then
  block "local exports (tmp/ or webapp_dbdata/) may contain personal data: do not read them."
fi

# 3. No data exfiltration: uploads via curl/wget, raw sockets, remote copies.
if printf '%s' "$cmd" | grep -Eq '(^|[;&| ])(curl|wget)[^;&|]*( -d| --data| -F| --form| -T| --upload-file| --post-file| -X *(POST|PUT|PATCH)| @)'; then
  block "sending data to an external server is forbidden (personal data / secrets)."
fi
if printf '%s' "$cmd" | grep -Eq '(^|[;&| ])(nc|ncat|netcat|scp|rsync|sftp|ftp)( |$)'; then
  block "network copy tools are forbidden in this project."
fi

# 4. Git writes are human-only (see AGENTS.md « Git : périmètre humain »).
if printf '%s' "$cmd" | grep -Eq '(^|[;&| ])git commit\b'; then
  block "git commit is reserved for human developers, not the AI. See AGENTS.md."
fi
if printf '%s' "$cmd" | grep -Eq '(^|[;&| ])git push\b'; then
  block "git push is reserved for human developers, not the AI. See AGENTS.md."
fi

# 5. Destructive or production commands (mirrors the Claude Code deny rules,
#    which Cursor has no project-level equivalent for).
if printf '%s' "$cmd" | grep -Eq 'pnpm db:(migrate|reset)|prisma migrate reset|make db-restore-from-prod|(^|[;&| ])scalingo |(^|[;&| ])(env|printenv)( |$)'; then
  block "forbidden command (migration / reset / production / env dump). See AGENTS.md."
fi

# 6. Prisma: unapplied migrations must not contain the bogus generated-column lines.
if printf '%s' "$cmd" | grep -Eq 'prisma migrate (deploy|dev)'; then
  if ! out=$("$(project_root)/.agents/hooks/check-migrations.sh" 2>&1); then
    block "$out"
  fi
fi

allow
