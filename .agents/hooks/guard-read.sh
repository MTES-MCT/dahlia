#!/usr/bin/env bash
# Cursor only (beforeReadFile): denies reading secrets and personal data exports.
# Claude Code uses the `permissions.deny` Read rules of .agents/settings.json instead.
# Must always print valid JSON: invalid output blocks the read.
set -uo pipefail

HOOK_INPUT=$(cat)
# shellcheck source=lib.sh
. "$(dirname "$0")/lib.sh"

file=$(printf '%s' "$HOOK_INPUT" | jq -r '.file_path // ""')
root=$(project_root)
rel="${file#"$root"/}"

case "$rel" in
  .env.example) ;;
  .env | .env.* | tmp/* | webapp_dbdata/*)
    jq -n --arg m "⛔ guard-read: $rel may contain secrets or personal data (see AGENTS.md, Sécurité)." \
      '{permission: "deny", user_message: $m}'
    exit 0
    ;;
esac
echo '{"permission": "allow"}'
