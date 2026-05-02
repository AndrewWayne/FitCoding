# FitCoding follow-up items

Polish items deferred from code-quality reviews during v0.0.1 execution. None block release; address before tagging or in v0.0.2.

## From Plan Task 27 (commit 3ed6221 — README.md)

- **Privacy section omits the jsDelivr WASM fetch.** `pose/index.ts:7` loads MediaPipe's WASM runtime from `cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm` on first launch — only the `.task` model file is mentioned. Add a one-line disclosure: "MediaPipe WASM runtime is fetched from jsDelivr (cdn.jsdelivr.net) on first launch."
- **Binary size estimate (~10–20 MB) is unverified.** Replace with measured size after the first real release artifact lands.
- **macOS Gatekeeper framing.** README says "After first launch, if macOS blocks it" — Gatekeeper actually blocks BEFORE first launch. Reword to "If macOS blocks the binary on first launch attempt..."
- **Linux camera-permission story is silent.** macOS gets a note about the permission prompt; Linux/Windows don't. Browser/WebView camera prompts on Linux can be surprising in a frameless Tauri window.

## From Plan Task 26 (commit 28ac238 — release.yml)

- **Smoke-test the workflow via `workflow_dispatch` BEFORE the first `v*.*.*` tag push.** Specifically validates the Ubuntu apt list against an actual Tauri 2 build — the most common silent-failure mode is missing `libsoup-3.0-dev` or `libjavascriptcoregtk-4.1-dev`. Cheaper to find on a manual trigger than via a half-failed Release.
- **Add `cargo build --locked`** to the release build step. Mirrors `npm ci`'s lockfile-strict pattern. Without `--locked`, CI may quietly update `Cargo.lock` if a transitive dep is yanked, breaking reproducibility of release artifacts.
- **Add concurrency guard** to prevent races on rapid tag re-pushes:
  ```yaml
  concurrency:
    group: release-${{ github.ref }}
    cancel-in-progress: false
  ```
- **Add `Swatinem/rust-cache@v2`** after the toolchain step — typically halves matrix wall time on Tauri projects. v0.0.2 polish; v0.0.1 ships fine without it.
- **One-line comment** in the release job explaining why no `actions/checkout` (intentional — softprops uses GitHub API, no local refs needed).
- **`macos-13` runner deprecation horizon**: GitHub announced sunset; before v0.0.2, switch to `macos-latest` cross-build with `MACOSX_DEPLOYMENT_TARGET` env to keep min-OS sane.

## From Plan Task 24 (commit 910081f — fit.ps1)

- **`-WindowStyle Hidden` is semantically wrong** for Tauri launch — Tauri opens its own visible GUI window; the `-WindowStyle` flag affects only console-mode parents. Drop the flag: `Start-Process -FilePath $Bin -ArgumentList "launch"` returns immediately and doesn't hide anything.
- **ARM64 Windows is silently mis-detected as x64**. `OSArchitecture` returns `"ARM 64-bit Processor"` which matches `*64-bit*` and routes to `x86_64-pc-windows-msvc`. The x64 binary runs under emulation so it "works," but blocks any future native ARM build. Fix: switch to `$env:PROCESSOR_ARCHITECTURE` (returns `AMD64` / `ARM64` / `x86`) and explicitly handle each, or fail loudly on ARM64 until the native build exists.
- **Temp-file leak on download failure**: `Invoke-WebRequest` throw bypasses `Remove-Item $zip`. Wrap in `try { ... } finally { if (Test-Path $zip) { Remove-Item $zip -Force } }`.
- **Default branch double-signals** with `Write-Error` + `exit 1` under `ErrorActionPreference = "Stop"`. Use `[Console]::Error.WriteLine(...)` + `exit 1`, or `throw`.
- **Verify Task 26's release pipeline produces `.zip` for Windows AND `.tar.gz` for Unix** — fit.ps1 expects `.zip`, fit.sh expects `.tar.gz`.

## From Plan Task 22 (commit 613616c — plugin.json + fit.md)

- **Windows bash dependency**: `.claude-plugin/commands/fit.md` invokes `bash "${CLAUDE_PLUGIN_ROOT}/scripts/fit.sh"`. Claude Code on Windows does NOT bundle Git Bash. README must document Git Bash or WSL as an install prerequisite. Optionally enhance the bootstrap chain to detect missing bash and print a one-line install hint.

## From Plan Task 21 (commit 9be94f3 — main.ts orchestration)

- **HIGH PRIORITY (fix before tagging v0.0.1)** — main.ts:67 stale skeleton bug. When `pose.detect()` returns null, the form-cue updates to "Step into frame" but `webcam.drawSkeleton(null)` is never called, so the last-known skeleton stays painted on the canvas. Visually contradictory ("Step into frame" + skeleton still drawn). One-line fix: add `webcam.drawSkeleton(null);` before the `cueEl.textContent = "Step into frame"` line. The `Webcam` interface was designed to accept null exactly for this case.
- **Shadow `.js` files in `app/src/`**: working tree has stale `*.js` co-located with `*.ts` (likely from a prior `tsc` invocation). Vitest discovers tests twice (29 unique → 58 reported). Add `app/src/**/*.js` to root `.gitignore`, then `find app/src -name "*.js" -delete`.
- **`frameTimestamp += 33` precision (v0.0.2)**: rAF fires at ~16.67ms but increment is fixed 33ms — MediaPipe perceives the video as half-speed. Swap to `performance.now()` for accurate temporal smoothing.
- **`cueEl.textContent = exercise.formCue` runs every frame** on the success path. Negligible (4-char string, no reflow), but could be set once after countdown and only overwritten when entering "Step into frame".
- **No teardown of `pixelMan` sprite reference**: `HTMLImageElement` GC'd when `pixelMan` goes out of scope at function exit, fine for v1; for symmetry, null the sprite in a webview-close handler.

## From Plan Task 20 (commit 1c4b0aa — launch.rs Tauri IPC)

- **Drop `Mutex<&'static str>` post-v0.0.1**: cell is read-only in v1; `&'static str` is `Sync` on its own. Simplify to `manage(chosen)` + `state: State<'_, &'static str>`.
- **Log window-reveal errors in `setup`**: currently `.show().ok()` swallows two failure modes (missing window, OS show failure) silently. Replace with explicit `match`/`if let Err` + `eprintln!` so a user reporting "nothing happened" leaves a stderr trail.
- **`build.rs` requires `app/dist/`**: `tauri::generate_context!` reads `frontendDist: ../dist` at compile time. Bare `cargo build` from `app/src-tauri/` fails confusingly without a prior `npm run build`. Document in README (Task 27) or have a `build.rs` shim run `npm run build` (latter has trade-offs around `npm` on PATH).
- **Local-time midnight crossing**: `Local::now().date_naive()` for the score date means a session starting at 23:59:55 and ending at 00:00:25 saves under yesterday's date. Document in README "Known Limitations".
- **Task 21 reminder**: `main.ts` must `.catch()` the `save_score` invoke promise to avoid an unhandled rejection if disk write fails.

## From Plan Task 19 (commit cfd9bb5 — overlay.ts)

- **Add a jsdom unit test** for `showScore` to lock down the `PRETTY_NAMES` mapping and the "Congrats! N exercises in 30s" string format. Vitest's jsdom env is already configured. ~10 lines covers all three exercise labels + the unknown-name fallback path. Cheap regression guard.

## From Plan Task 18 (commit 4812144 — timer.ts)

- **Cadence docstring lies**: `runSessionTimer` says "about 10x/second" but it's `requestAnimationFrame`, so 60-120 Hz. Fix to "once per animation frame" or "at the display refresh rate".
- **Add fake-timer tests for timer factories**: vitest `vi.useFakeTimers()` + stubbed `requestAnimationFrame` could cheaply test (a) intro countdown calls onTick in order at 700ms intervals, (b) cancel mid-sequence prevents subsequent ticks, (c) session timer resolves at exactly durationMs and clamps remainingMs >= 0.
- **Document sync first tick**: `runIntroCountdown` fires `onTick("3")` synchronously inside the promise constructor before returning the handle. Add JSDoc `@remarks First label fires synchronously` for callers who want pre-mount-aware tick handlers.

## From Plan Task 17 (commit 82e8437 — pixelman.ts) — apply at Task 21

- **Await sprite preload**: `pixelMan.draw()` no-ops silently when the sprite isn't loaded. Task 21's main.ts must `await pixelMan.setSpriteUrl(...)` before entering the rAF loop, otherwise the canvas stays blank until the image loads.
- **Catch sprite load errors**: `setSpriteUrl` rejects on 404/network failure. Task 21 should `.catch(err => console.warn(...))` and ideally show a placeholder via the overlay.

## From Plan Task 16 (commit e537e60 — webcam.ts)

- **MUST VERIFY at end-to-end smoke test (Task 28)**: webcam stream is requested at 640×480 (4:3) but displayed at 360×360 (1:1) via CSS `object-fit: cover`, which center-crops 80px from each side. MediaPipe landmarks are normalized over the full 4:3 frame, so landmarks near the cropped edges may render outside the visible video region. If skeleton visibly drifts during smoke test, fix by requesting a square stream (`getUserMedia({video: {width: 480, height: 480}})`) or by accounting for the crop offset in `drawSkeleton`.
- **Visibility threshold extraction**: hardcoded `0.3` at two call sites in webcam.ts. If exercise modules in Tasks 11-13 also need a visibility gate (currently they don't but should — see existing follow-up), extract `VISIBILITY_THRESHOLD` to `pose/constants.ts`.
- **Webcam interface lacks JSDoc**: add `@throws` notes to `start()` so Task 21's main.ts implementer knows to handle camera-permission denials.

## From Plan Task 15 (commit ad0d00d — pose/index.ts)

- **Pin `@mediapipe/tasks-vision` exactly**: `package.json` has `^0.10.14` (caret) but the WASM CDN URL is hardcoded `@0.10.14`. If npm resolves a newer minor, the JS shim and WASM blobs diverge → confusing runtime errors. Either pin to `0.10.14` exact, or derive the version from `package.json` at build time.
- **Worker-based pose detection (v0.0.2)**: `detectForVideo` is sync and runs on the rAF loop thread. On low-end GPUs falling back to CPU, frame drops are likely. MediaPipe ≥0.10 supports `OffscreenCanvas`/Worker — move detection there before tagging.
- **Offline bundle (v0.0.2)**: model URL hardcodes `/1/pose_landmarker_lite.task` from Google's CDN. For full offline support, vendor the WASM + .task file into the build.

## From Plan Task 13 (commit 0706799 — jumping_jack.ts)

- **Asymmetric-ratio test gap**: tests cover `closed→opened` and `closed→halfway→closed`, but never the dual-ratio AND condition's failure modes. Add a test where wrists open but ankles stay closed (or vice versa) and assert `reps === 0` — pins the AND semantics that distinguish jumping_jack from squat/pushup.
- **`progress` vs `phase` boundary mismatch**: `progress` averages the two ratios (so reaches 1 before phase flips) while `phase` requires BOTH to exceed `OPEN_RATIO`. Squat/pushup don't have this gap. Either base `progress` on `Math.min(wristRatio, ankleRatio)` to align, or document the intentional difference inline.
- **Add test for divide-by-zero guards** (`shoulderWidth > 0 ? ... : 0`): construct `landmarksWithGeom({shoulderWidth: 0, hipWidth: 0, wristGap: 0.3, ankleGap: 0.3})`, assert `update()` doesn't throw and returns a defensible `phase`.

## From Plan Task 12 (commit ca51f56 — pushup.ts)

- **Refactor: extract angle-based state-machine helper for squat + pushup**. The two modules share ~95% identical code (factory shape, `clamp01`, state-machine block, L/R averaging). Extract `app/src/exercises/angle-state-machine.ts` with signature `createAngleRepCounter({name, formCue, downThreshold, upThreshold, measureAngle})` so squat/pushup collapse to ~10 lines each. Apply visibility + ready-phase fixes once at the helper level. Note: jumping_jack (Task 13) uses distance ratios not angles — it won't fit this helper, but will share the closure-state + clamp01 pattern with its own counterpart helper. Worth doing before tagging v0.0.1.

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
