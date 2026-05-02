# FitCoding follow-up items

Polish items deferred from code-quality reviews during v0.0.1 execution. None block release; address before tagging or in v0.0.2.

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
