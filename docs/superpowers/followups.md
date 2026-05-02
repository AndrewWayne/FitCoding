# FitCoding follow-up items

Polish items deferred from code-quality reviews during v0.0.1 execution. None block release; address before tagging or in v0.0.2.

## From Plan Task 11 (commit 14069f2 — squat.ts) — applies to all 3 exercise modules

- **Visibility ignored across squat / pushup / jumping_jack**: MediaPipe returns landmarks even for occluded joints (often stale `(x, y, z)` near origin). Currently all three modules average left+right angles without checking `landmark.visibility`, which can cause spurious phase transitions when a user steps partly out of frame. Solve once at the rep-counter layer (e.g. only use limbs above a `VIS_MIN = 0.5` threshold; if both sides invisible, return `{reps, phase, progress: 0}` without state change). Touch all three modules in one follow-up commit.
- **`"ready"` phase semantics**: `RepPhase = "ready" | "down" | "up"` admits `"ready"`, but no branch in any `update()` produces it — it's only the pre-first-frame value, immediately overwritten. Two options: (a) drop `"ready"` from the type and initialize `phase` as `"up"`, or (b) document `"ready"` as transient. Test names like `"starts in 'ready' with zero reps"` actually assert `phase === "up"` — fix the test name or the implementation, not both.
- **`landmarks.length < 33` guard**: defensive one-liner at the top of each `update()` to prevent crashes if MediaPipe ever returns a partial result.

## From Plan Task 9 (commit 28db305 — angles.ts)

- **Zero-magnitude sentinel**: `angleAtVertex` returns `0` when one of the rays has zero magnitude. `0` is also a valid result (collinear-same-side), so callers can't distinguish degenerate input from a real 0° pose. Consider returning `NaN` — propagates naturally and forces consumers to handle the case explicitly. Coordinate the change with all callers in Tasks 11-13 if changing.

## From Plan Task 8 (commit 3ee90b4 — HTML/CSS layout)

- **CRITICAL FOR TASK 16**: The `#skeleton` canvas is 400×400 but `#cam` video is 360×360. The skeleton sits centered with `left: 50%; translateX(-50%)`, leaving a 20px margin on each side. Pose landmarks normalized to `[0, 1]` must be drawn at `landmark.x * 360` (not 400) to align with the video frame. When implementing `webcam.ts::drawSkeleton()` in Task 16, factor in this offset — either render to a 360-coord space or shift by 20px on each axis. Otherwise joints will appear ~20px off near the edges.
- **Accessibility gap (v0.0.2)**: No ARIA. Add `aria-live="polite"` to `#hud`, `aria-live="assertive"` to `#overlay`, and promote `#exercise-name` to `<h1>` so screen-reader users get rep/time updates.
- **CSS comments worth adding**: document the canvas-buffer-vs-display-size distinction on `#cam` and `#skeleton` (HTML `width`/`height` attrs set the drawing buffer; CSS sets display size; they're intentionally different).

## From Plan Task 7 (commit 271c733 — launch.rs)

- **launch.rs:16** — `unwrap_or("squat")` masks a structural impossibility (`EXERCISES` is `[&str; 3]`, never empty). Replace with `.expect("EXERCISES is non-empty")` to document the invariant rather than silently fall back.
- **Optional**: change `resolve_exercise(arg: Option<String>)` to `Option<&str>` to save `.into()` allocations at test sites and tighten the API. Free since clap can pass either shape.
- **Optional test**: add explicit "unknown string passes to random" test (e.g. `resolve_exercise(Some("yoga".into()))` must return one of `EXERCISES`). Already covered transitively by the `"random"` test, but worth pinning if `resolve_exercise` is ever called outside clap.

## From Plan Task 6 (commit b8a3dd6 — main.rs Cmd::Board arm)

- **Inconsistent error message prefix** in main.rs: one site emits `fitcoding: {e}`, the other `fitcoding: failed to read scores: {e}`. Both `default_path` and `load` already carry context via `anyhow::Context`; normalize to a single form using the cause-chain formatter `{e:#}` (e.g. `eprintln!("fitcoding: {e:#}")`).
- Optional: factor a `fn die(e: impl Display) -> !` helper to deduplicate the two `match`-and-exit blocks. Saves ~6 lines.

## Compiler warnings to clean up before tagging

- `app/src-tauri/src/board.rs:1` — `use crate::scores::{Session, ScoresFile};` flags `Session` as unused at the file level (it's only consumed in `#[cfg(test)] mod tests`). Move `use super::Session;` into the test module to silence cleanly.
- `app/src-tauri/src/scores.rs:36` — `pub fn append` is currently unused. Will be consumed by the Tauri `save_score` IPC handler in Phase 5 / Task 20. Warning resolves itself then; don't `#[allow]` it.

## From Plan Task 5 (commit 32b4c1b — board.rs)

- **board.rs test `sums_multiple_sessions_for_same_day_and_exercise`** — `today_row.contains("5")` passes only because 22 doesn't contain 5. Change a fixture value and the test passes for the wrong reason. Replace with a tokenized check (split row by whitespace, compare cells) or assert against the exact padded substring.
- **Test gaps in board.rs**: add tests for (a) all 7 days populated — locks the `0..HISTORY_DAYS` loop bounds, (b) grand total spans multiple days, (c) sessions older than 7 days are excluded from TOTAL.
- **Header column 1 unlabeled** — first cell in header row is `""`. A one-word header like `"date"` would make `/fit board` output self-explanatory.

## From Plan Task 4 (commit a035560 — scores.rs)

- **scores.rs:38-40** — Drop the dead `if current.version == 0 { current.version = 1; }` branch in `append`. Reachable only via `ScoresFile::default()` round-trip, not via the public API. If schema migrations are ever needed, do them in `load` with explicit version dispatch.
- **scores.rs:46** — Add `.context("serializing scores")` to the `serde_json::to_string_pretty` call for consistency with the other `?` contexts in `append`.
- **scores.rs (new test)** — Pin `default_path()` with a one-line test asserting the suffix is `.fitcoding/scores.json`. Doubles as a `#[allow(dead_code)]` substitute and locks the spec §6 path contract.
- **scores.rs (new test)** — Round-trip shape test: `append` a session, read the file as raw text, deserialize via `serde_json::Value`, assert the on-disk shape matches the spec §6 schema (`{version: 1, sessions: [{date, exercise, reps}]}`). Protects future refactors from silently breaking Task 20's IPC contract.
- **Crash atomicity** — `append` uses `fs::write` which truncates-then-writes. A crash mid-write loses all prior history. Standard fix: write to `scores.json.tmp`, then `fs::rename`. Two lines, atomic on Win/Mac/Linux. Either implement or update the spec's risk register (§8) to call out the gap.
- **API tightness** — Make `ScoresFile::version` private with a getter so consumers can't mutate the version field directly. Low priority — only matters once Task 20 (IPC) lands and we have multiple consumers.

## From Plan Task 2 (commit c6e8b59 — Cargo.toml)

- **Tauri default features** — `tauri = { version = "2" }` pulls `tray-icon` and other defaults we don't use. Once `launch.rs` (Task 7/20) is wired and we know exactly what features we need, prune the default set.
- **Dependency bumps** — `rand = "0.8"` and `dirs = "5"` are each one major behind. APIs unchanged; bump in a single dependency-refresh pass before tagging v0.0.1.
- **Stricter CSP** — `tauri.conf.json` has `"security": { "csp": null }`. Tighten to a strict CSP (e.g. `"default-src 'self'; script-src 'self'"`) when the IPC layer lands in Task 20.

## From Plan Task 1 (commit 3b45945)

- **`tsconfig.json` `include`** — Has `"index.html"` in the include array, which TS ignores. Harmless but misleading. Drop it in a future tsconfig touch-up.
- **`vite.config.ts`** — Add `/// <reference types="vitest" />` at the top so the `test` block gets editor autocomplete + type-checking.

## Cross-cutting

- **`.gitattributes`** — Repo lacks one. Git emits `LF will be replaced by CRLF` warnings on every Windows commit. Add a `.gitattributes` declaring `* text=auto eol=lf` (or similar) before more contributors join.
- **`app/package-lock.json`** — Currently untracked. For an open-source project, commit it for reproducible installs.
