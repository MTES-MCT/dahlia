#!/usr/bin/env bash
# End-of-turn hook (Claude Code `Stop`, Cursor `stop`):
#   1. lint (Cursor only, Claude lints on each edit) + type-check + related unit
#      tests on the changed files; on failure the agent is sent back to fix them;
#   2. learning loop: if changed files match .agents/harness-triggers.txt, ask the
#      agent to PROPOSE (not apply) a harness update. Once per diff state.
# Re-prompting: Claude Code → exit 2 / {"decision":"block"}; Cursor → {"followup_message"}.
set -uo pipefail

HOOK_INPUT=$(cat)
# shellcheck source=lib.sh
. "$(dirname "$0")/lib.sh"

if is_cursor; then
  [ "$(printf '%s' "$HOOK_INPUT" | jq -r '.status // "completed"')" != "completed" ] && exit 0
else
  [ "$(printf '%s' "$HOOK_INPUT" | jq -r '.stop_hook_active // false')" = "true" ] && exit 0
fi

# Sends the agent back to work with a message (blocking failure).
fail() {
  if is_cursor; then
    jq -n --arg m "$1" '{followup_message: $m}'
    exit 0
  fi
  printf '%s\n' "$1" >&2
  exit 2
}

cd "$(project_root)" || exit 0
state_dir=".agents/.state"
mkdir -p "$state_dir"

changed=$(
  {
    git diff --name-only HEAD
    git ls-files --others --exclude-standard
  } | sort -u
)
[ -z "$changed" ] && exit 0

# Fingerprint of the current working tree changes (code-like files only).
code_files=$(printf '%s\n' "$changed" | grep -E '\.(ts|tsx|mts|mjs|prisma|sql|json|sh)$|^\.husky/' || true)
fingerprint=$(
  {
    git diff HEAD
    printf '%s\n' "$code_files" | while read -r f; do [ -f "$f" ] && shasum "$f"; done
  } | shasum | cut -d' ' -f1
)

# --- 1. Checks (skipped if this exact state already passed) -------------------
ts_files=$(printf '%s\n' "$changed" | grep -E '\.(ts|tsx)$' | grep -vE '\.d\.ts$' | while read -r f; do [ -f "$f" ] && echo "$f"; done)
if [ -n "$ts_files" ] && [ "$(cat "$state_dir/checks-pass" 2>/dev/null)" != "$fingerprint" ]; then
  if is_cursor; then
    # shellcheck disable=SC2086
    if ! out=$(pnpm exec eslint --no-warn-ignored $ts_files 2>&1); then
      fail "❌ ESLint failed, fix these errors:
$(echo "$out" | grep -E 'error' | head -n 30)"
    fi
  fi
  if ! out=$(pnpm exec tsc --noEmit 2>&1); then
    fail "❌ tsc --noEmit failed, fix these errors:
$(echo "$out" | grep -E 'error TS' | head -n 30)"
  fi
  # shellcheck disable=SC2086
  if ! out=$(pnpm exec vitest related --run --config vitest.unit.config.mts --passWithNoTests $ts_files 2>&1); then
    fail "❌ Related unit tests failed, fix them (ask before changing a test):
$(echo "$out" | grep -E 'FAIL|✗|×|Error|expected' | head -n 40)"
  fi
  echo "$fingerprint" >"$state_dir/checks-pass"
fi

# --- 2. Learning loop -----------------------------------------------------------
[ "$(cat "$state_dir/harness-last-check" 2>/dev/null)" = "$fingerprint" ] && exit 0
echo "$fingerprint" >"$state_dir/harness-last-check"

hits=""
while IFS= read -r line; do
  case "$line" in '' | \#*) continue ;; esac
  pattern="${line%% => *}"
  target="${line#* => }"
  matched=$(printf '%s\n' "$changed" | grep -E "$pattern" | head -n 3 | tr '\n' ' ')
  [ -n "$matched" ] && hits="${hits}- ${matched}→ ${target}\n"
done <.agents/harness-triggers.txt

[ -z "$hits" ] && exit 0

reason=$(printf "Learning loop: the changes touch areas covered by the AI harness.\n%bFor each line, check whether the harness is still accurate. If it is, say « harnais OK ». Otherwise PROPOSE the diff (AGENTS.md, skill, hook, permissions) WITHOUT applying it, and wait for the user's validation. Use the harness-sync skill for a full review." "$hits")
if is_cursor; then
  jq -n --arg m "$reason" '{followup_message: $m}'
else
  jq -n --arg r "$reason" '{decision: "block", reason: $r}'
fi
exit 0
