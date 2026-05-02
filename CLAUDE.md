# CLAUDE.md

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

## 5. Project-specific rules

`FitCoding` is a public open-source Claude Code plugin. The product is a `/fit` slash command that pops a 30-second exercise mini-game with webcam-based rep counting, plus a `/fit board` terminal scoreboard. Design spec: [`docs/superpowers/specs/2026-05-03-fitcoding-design.md`](./docs/superpowers/specs/2026-05-03-fitcoding-design.md).

- **Spec is the source of truth.** Any change to v1 scope (exercises, slash-command UX, scoreboard schema, distribution model) must update the spec in the same PR. If a discovered constraint forces a deviation, edit the spec first, then code to it.
- **YAGNI.** Three exercises (squat / jumping_jack / push-up), one scoreboard view, one window layout. Do not add streaks, PRs, HIIT mode, cloud sync, or extra exercises in v1 — they are explicitly listed as v2 candidates in §9 of the spec.
- **Single Rust binary.** The CLI surface is one binary `fitcoding` with subcommands `launch` and `board`. Do not split into multiple crates per subcommand. Do not introduce a separate Node.js daemon.
- **No React.** Webview frontend is Vite + vanilla TypeScript. Do not introduce React, Vue, Svelte, or any UI framework — keeps the bundle small and the dependency surface minimal.
- **Pose detection is MediaPipe.** Use `@mediapipe/tasks-vision` PoseLandmarker. Do not swap in a different library or train a custom model in v1. Rep-counting heuristics live in `app/src/exercises/<name>.ts`, one file per exercise.
- **Scores file location.** `~/.fitcoding/scores.json` (Unix) / `%USERPROFILE%\.fitcoding\scores.json` (Windows). Schema is defined in spec §6 with `version: 1`. Bumping `version` requires a migration path.
- **Cross-platform.** Every change must keep the GitHub Actions matrix green: `windows-latest`, `macos-14` (arm64), `macos-13` (x64), `ubuntu-22.04`. Do not introduce platform-specific code paths without a stub on the others.
- **Mac binaries ship unsigned in v1.** Do not add codesigning steps to the release workflow. The README documents `xattr -d com.apple.quarantine`. Codesigning is a v2 task.

If you're unsure whether a change crosses a v1/v2 boundary, re-read the spec's §2 (goals/non-goals) and §9 (out of scope) before opening a PR.
