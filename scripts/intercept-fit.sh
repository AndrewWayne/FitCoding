#!/usr/bin/env bash
# UserPromptSubmit hook for FitCoding.
# Intercepts prompts that start with "/fit" and runs the bootstrap script
# directly, BYPASSING the model. Lets /fit fire even when Claude is busy.
# Other prompts pass through unchanged.
#
# Requires: jq (Git Bash on Windows: install via `choco install jq` or
# similar; Linux/macOS: usually preinstalled or one apt/brew away).

set -euo pipefail

input=$(cat)

# Extract the prompt. If jq isn't available, the hook falls back to passing
# the prompt through untouched (better than blocking everything).
if ! command -v jq >/dev/null 2>&1; then
  exit 0
fi

prompt=$(printf '%s' "$input" | jq -r '.prompt // empty' 2>/dev/null || true)

# Only intercept when the prompt LITERALLY begins with /fit (followed by end,
# space, or arg). Don't fire on things like "say /fit later".
if [[ ! "$prompt" =~ ^/fit($|[[:space:]]) ]]; then
  exit 0
fi

# Strip the /fit prefix and any leading whitespace.
args="${prompt#/fit}"
args="${args# }"

case "$args" in
  ""|launch)
    # Spawn detached so the hook returns immediately; the Tauri window
    # outlives this shell.
    nohup bash "${CLAUDE_PLUGIN_ROOT}/scripts/fit.sh" >/dev/null 2>&1 &
    disown 2>/dev/null || true
    output="FitCoding window launching..."
    ;;
  board)
    output="$(bash "${CLAUDE_PLUGIN_ROOT}/scripts/fit.sh" board 2>&1)"
    ;;
  *)
    output=$'Usage:\n  /fit          start a 30s exercise\n  /fit board    print the scoreboard'
    ;;
esac

# Return JSON telling Claude Code to block the prompt and surface our output
# as a system context bubble in the chat.
jq -n --arg ctx "$output" '{
  decision: "block",
  reason: "fitcoding intercepted /fit",
  hookSpecificOutput: {
    hookEventName: "UserPromptSubmit",
    additionalContext: $ctx
  }
}'
