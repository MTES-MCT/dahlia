#!/usr/bin/env bash
# Shared helpers for the AI harness hooks (Claude Code + Cursor).
# Source it after reading stdin into $HOOK_INPUT.

# Cursor sends `cursor_version` in every hook payload (and CURSOR_VERSION env).
is_cursor() {
  [ -n "${CURSOR_VERSION:-}" ] || [ "$(printf '%s' "$HOOK_INPUT" | jq -r '.cursor_version // empty')" != "" ]
}

# Both tools export CLAUDE_PROJECT_DIR (Cursor as a compatibility alias).
project_root() {
  printf '%s' "${CLAUDE_PROJECT_DIR:-${CURSOR_PROJECT_DIR:-$(git rev-parse --show-toplevel)}}"
}
