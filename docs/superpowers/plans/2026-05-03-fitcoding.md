# FitCoding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a public open-source Claude Code plugin where `/fit` opens a 30-second webcam-driven exercise mini-game (squat / jumping_jack / pushup) with live rep counting via MediaPipe pose detection, and `/fit board` prints a daily scoreboard from a local JSON file.

**Architecture:** Single Rust binary (`fitcoding`) built with Tauri 2 + clap. Subcommand `launch` opens a frameless always-on-top window whose webview hosts the UI; subcommand `board` is plain CLI (no window). Webview is Vite + vanilla TypeScript with `@mediapipe/tasks-vision` doing pose landmarking and per-exercise state machines doing rep counting. Score persistence is on the Rust side, written to `~/.fitcoding/scores.json` on a Tauri IPC event.

**Tech Stack:** Rust 1.75+, Tauri 2.x, clap 4.x, serde + serde_json, chrono, anyhow; TypeScript 5.x, Vite 5.x, vitest 1.x, @tauri-apps/api 2.x, @mediapipe/tasks-vision; GitHub Actions for the multi-OS release matrix.

**Spec:** [`docs/superpowers/specs/2026-05-03-fitcoding-design.md`](../specs/2026-05-03-fitcoding-design.md).

---

## File Structure

The repo will end up with these files. Each task creates a focused subset.

```
FitCoding/
├── .claude-plugin/
│   ├── plugin.json                   # Claude Code plugin manifest
│   ├── commands/
│   │   └── fit.md                    # /fit slash command
│   └── scripts/
│       ├── fit.sh                    # Unix bootstrap (download binary, route args)
│       └── fit.ps1                   # Windows bootstrap
├── app/
│   ├── package.json                  # Vite + TS frontend deps
│   ├── tsconfig.json
│   ├── vite.config.ts
│   ├── index.html                    # Vite entry (NOTE: at app/, not app/src/)
│   ├── src/
│   │   ├── main.ts                   # webview orchestration
│   │   ├── ipc.ts                    # Tauri IPC wrappers
│   │   ├── styles.css
│   │   ├── pose/
│   │   │   ├── index.ts              # MediaPipe Pose Landmarker wrapper
│   │   │   └── types.ts              # Landmark, PoseResult
│   │   ├── exercises/
│   │   │   ├── types.ts              # ExerciseModule interface, RepPhase
│   │   │   ├── angles.ts             # joint-angle math (shared utility)
│   │   │   ├── squat.ts
│   │   │   ├── jumping_jack.ts
│   │   │   ├── pushup.ts
│   │   │   ├── index.ts              # registry: name → ExerciseModule
│   │   │   ├── angles.test.ts
│   │   │   ├── squat.test.ts
│   │   │   ├── jumping_jack.test.ts
│   │   │   └── pushup.test.ts
│   │   ├── ui/
│   │   │   ├── webcam.ts             # video element + skeleton overlay
│   │   │   ├── pixelman.ts           # sprite canvas
│   │   │   ├── pixelman.test.ts
│   │   │   ├── timer.ts              # 30s countdown + 3-2-1 intro
│   │   │   ├── timer.test.ts
│   │   │   └── overlay.ts            # countdown overlay + final score screen
│   │   └── assets/sprites/
│   │       ├── squat.png             # 4-frame sprite sheet
│   │       ├── jumping_jack.png
│   │       └── pushup.png
│   └── src-tauri/
│       ├── Cargo.toml
│       ├── tauri.conf.json
│       ├── build.rs                  # Tauri build script (boilerplate)
│       └── src/
│           ├── main.rs               # argv branch: launch | board
│           ├── launch.rs             # tauri::Builder + IPC handlers
│           ├── board.rs              # format scoreboard table
│           └── scores.rs             # JSON load/append
├── .github/
│   └── workflows/
│       └── release.yml               # build matrix + GitHub Release
├── docs/superpowers/
│   ├── specs/2026-05-03-fitcoding-design.md
│   └── plans/2026-05-03-fitcoding.md  ← this doc
├── CLAUDE.md
├── LICENSE
├── README.md
└── .gitignore
```

**Spec §10 deviation:** The spec sketched `index.html` at `app/src/index.html`. Vite expects `index.html` at the project root (`app/`) by default; we follow the Vite default to avoid configuring a non-standard `root` and to match every Tauri-Vite tutorial out there. The frontend TS lives in `app/src/`.

**Decomposition principle:** One file = one responsibility. Exercise modules are split per exercise so each rep-counting heuristic is testable in isolation. UI components are split by panel so canvas drawing logic doesn't tangle with timer logic.

---

## Phase 1 — Repo scaffolding & build pipeline

### Task 1: Frontend scaffolding (package.json, tsconfig, vite config)

**Files:**
- Create: `app/package.json`
- Create: `app/tsconfig.json`
- Create: `app/vite.config.ts`
- Create: `app/index.html`
- Create: `app/src/main.ts`
- Create: `app/src/styles.css`

- [ ] **Step 1: Create `app/package.json`**

```json
{
  "name": "fitcoding-app",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "tauri": "tauri"
  },
  "dependencies": {
    "@tauri-apps/api": "^2.0.0",
    "@mediapipe/tasks-vision": "^0.10.14"
  },
  "devDependencies": {
    "@tauri-apps/cli": "^2.0.0",
    "typescript": "^5.4.0",
    "vite": "^5.2.0",
    "vitest": "^1.6.0",
    "jsdom": "^24.0.0"
  }
}
```

- [ ] **Step 2: Create `app/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "types": ["vite/client", "vitest/globals"]
  },
  "include": ["src/**/*", "index.html"]
}
```

- [ ] **Step 3: Create `app/vite.config.ts`**

```ts
import { defineConfig } from "vite";

export default defineConfig({
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
  },
  build: {
    target: "es2022",
    sourcemap: true,
  },
  test: {
    environment: "jsdom",
    globals: true,
  },
});
```

- [ ] **Step 4: Create `app/index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>FitCoding</title>
    <link rel="stylesheet" href="/src/styles.css" />
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

- [ ] **Step 5: Create `app/src/main.ts` placeholder**

```ts
const root = document.getElementById("app");
if (root) {
  root.textContent = "FitCoding webview booting...";
}
```

- [ ] **Step 6: Create `app/src/styles.css`**

```css
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body, #app { width: 100%; height: 100%; }
body {
  background: #0a0a0a;
  color: #f0f0f0;
  font-family: -apple-system, "Segoe UI", system-ui, sans-serif;
  overflow: hidden;
}
```

- [ ] **Step 7: Install dependencies**

Run: `cd app && npm install`
Expected: `node_modules/` populated, no errors.

- [ ] **Step 8: Verify Vite dev server starts**

Run: `cd app && npm run dev`
Expected: Vite reports "Local: http://localhost:1420/". Open URL in browser → page shows "FitCoding webview booting...". Stop with Ctrl+C.

- [ ] **Step 9: Commit**

```bash
git add app/package.json app/tsconfig.json app/vite.config.ts app/index.html app/src/main.ts app/src/styles.css
git commit -m "scaffold: vite + typescript frontend skeleton"
```

---

### Task 2: Tauri Rust scaffolding

**Files:**
- Create: `app/src-tauri/Cargo.toml`
- Create: `app/src-tauri/build.rs`
- Create: `app/src-tauri/tauri.conf.json`
- Create: `app/src-tauri/src/main.rs`
- Create: `app/src-tauri/icons/icon.ico` (Windows requires this even when bundling is off — see Step 3a)
- Modify: `.gitignore` (add `app/src-tauri/gen/`)

- [ ] **Step 1: Create `app/src-tauri/Cargo.toml`**

```toml
[package]
name = "fitcoding"
version = "0.0.1"
edition = "2021"
description = "FitCoding — /fit pop-up exercise mini-game for Claude Code"
license = "MIT"

[[bin]]
name = "fitcoding"
path = "src/main.rs"

[build-dependencies]
tauri-build = { version = "2" }

[dependencies]
tauri = { version = "2" }
clap = { version = "4", features = ["derive"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
chrono = { version = "0.4", default-features = false, features = ["clock", "serde"] }
anyhow = "1"
rand = "0.8"
dirs = "5"

[dev-dependencies]
tempfile = "3"

[profile.release]
opt-level = "s"
lto = true
codegen-units = 1
strip = true
```

- [ ] **Step 2: Create `app/src-tauri/build.rs`**

```rust
fn main() {
    tauri_build::build();
}
```

- [ ] **Step 3: Create `app/src-tauri/tauri.conf.json`**

```json
{
  "$schema": "https://schema.tauri.app/config/2",
  "productName": "FitCoding",
  "version": "0.0.1",
  "identifier": "io.github.andrewwayne.fitcoding",
  "build": {
    "beforeDevCommand": "npm run dev",
    "beforeBuildCommand": "npm run build",
    "devUrl": "http://localhost:1420",
    "frontendDist": "../dist"
  },
  "app": {
    "windows": [
      {
        "title": "FitCoding",
        "width": 800,
        "height": 500,
        "resizable": false,
        "decorations": false,
        "alwaysOnTop": true,
        "center": true,
        "visible": false
      }
    ],
    "security": {
      "csp": null
    }
  },
  "bundle": {
    "active": false,
    "icon": ["icons/icon.ico"]
  }
}
```

Note: `visible: false` because `launch.rs` will show the window programmatically only after the exercise has been picked. `bundle.active: false` because v0.0.1 ships bare binaries (the GitHub Actions workflow runs `cargo build --release` and zips the resulting executable directly), and we don't generate installers. **However** — `tauri-build` on Windows still embeds an .ico as a Win32 resource into the .exe regardless of bundling, so we must point `bundle.icon` at a real file. Re-enabling installers (and proper icon art) is a v2 task.

- [ ] **Step 3a: Generate placeholder icon**

```bash
pip install --quiet pillow
mkdir -p app/src-tauri/icons
python -c "
from PIL import Image
img = Image.new('RGBA', (256, 256), (40, 40, 50, 255))
img.save('app/src-tauri/icons/icon.ico', sizes=[(16,16),(32,32),(48,48),(256,256)])
"
```

Expected: `app/src-tauri/icons/icon.ico` exists, ~1-5 KB, contains 4 size frames. Pillow's PNG-compressed multi-size .ico is what tauri-build wants.

- [ ] **Step 3b: Append `app/src-tauri/gen/` to root `.gitignore`**

`tauri-build` regenerates schema files under `app/src-tauri/gen/` on every build. Append to `.gitignore`:

```
# Tauri-generated schemas (regenerated on each build)
app/src-tauri/gen/
```

- [ ] **Step 4: Create `app/src-tauri/src/main.rs` (minimal stub)**

```rust
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    println!("fitcoding stub - subcommands wired in Task 5");
}
```

- [ ] **Step 5: Verify Rust build**

Run: `cd app/src-tauri && cargo build`
Expected: `Compiling fitcoding v0.0.1`, no errors. `target/debug/fitcoding(.exe)` exists.

- [ ] **Step 6: Verify stub runs**

Run: `./target/debug/fitcoding` (or `.\target\debug\fitcoding.exe` on Windows)
Expected stdout: `fitcoding stub - subcommands wired in Task 5`

- [ ] **Step 7: Commit**

`Cargo.lock` should be committed for reproducibility — this is a binary crate, not a library.

```bash
git add app/src-tauri/Cargo.toml app/src-tauri/build.rs app/src-tauri/tauri.conf.json app/src-tauri/src/main.rs app/src-tauri/icons/icon.ico app/src-tauri/Cargo.lock .gitignore
git commit -m "scaffold: tauri 2 + clap + serde rust crate"
```

---

## Phase 2 — Rust CLI core

### Task 3: argv parsing with clap

**Files:**
- Modify: `app/src-tauri/src/main.rs`

- [ ] **Step 1: Write a failing test inline in main.rs**

Replace `app/src-tauri/src/main.rs` with:

```rust
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use clap::{Parser, Subcommand};

#[derive(Parser, Debug, PartialEq)]
#[command(name = "fitcoding", version)]
struct Cli {
    #[command(subcommand)]
    command: Option<Cmd>,
}

#[derive(Subcommand, Debug, PartialEq)]
enum Cmd {
    /// Open the exercise window.
    Launch {
        /// Force a specific exercise (dev-only). Defaults to a random pick.
        #[arg(long, value_parser = ["random", "squat", "jumping_jack", "pushup"])]
        exercise: Option<String>,
    },
    /// Print the scoreboard to stdout.
    Board,
}

fn main() {
    let cli = Cli::parse();
    match cli.command.unwrap_or(Cmd::Launch { exercise: None }) {
        Cmd::Launch { exercise } => {
            println!("(stub) launch exercise={:?}", exercise);
        }
        Cmd::Board => {
            println!("(stub) board");
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use clap::Parser;

    #[test]
    fn no_args_means_launch_with_no_exercise() {
        let cli = Cli::try_parse_from(["fitcoding"]).unwrap();
        assert_eq!(cli.command, None);
    }

    #[test]
    fn explicit_launch_no_flag() {
        let cli = Cli::try_parse_from(["fitcoding", "launch"]).unwrap();
        assert_eq!(cli.command, Some(Cmd::Launch { exercise: None }));
    }

    #[test]
    fn launch_with_exercise() {
        let cli = Cli::try_parse_from(["fitcoding", "launch", "--exercise", "squat"]).unwrap();
        assert_eq!(cli.command, Some(Cmd::Launch { exercise: Some("squat".into()) }));
    }

    #[test]
    fn launch_rejects_unknown_exercise() {
        let res = Cli::try_parse_from(["fitcoding", "launch", "--exercise", "yoga"]);
        assert!(res.is_err());
    }

    #[test]
    fn board_subcommand() {
        let cli = Cli::try_parse_from(["fitcoding", "board"]).unwrap();
        assert_eq!(cli.command, Some(Cmd::Board));
    }
}
```

- [ ] **Step 2: Run tests**

Run: `cd app/src-tauri && cargo test`
Expected: 5 passed, 0 failed.

- [ ] **Step 3: Smoke-test the CLI**

Run: `cd app/src-tauri && cargo run -- board`
Expected stdout: `(stub) board`

Run: `cargo run -- launch --exercise pushup`
Expected stdout: `(stub) launch exercise=Some("pushup")`

Run: `cargo run`
Expected stdout: `(stub) launch exercise=None`

Run: `cargo run -- launch --exercise yoga`
Expected: clap error message naming `yoga` as invalid, exit code 2.

- [ ] **Step 4: Commit**

```bash
git add app/src-tauri/src/main.rs
git commit -m "feat(cli): clap subcommand routing for launch/board"
```

---

### Task 4: Score persistence module

**Files:**
- Create: `app/src-tauri/src/scores.rs`
- Modify: `app/src-tauri/src/main.rs` (add `mod scores;`)

- [ ] **Step 1: Write the failing tests**

Create `app/src-tauri/src/scores.rs`:

```rust
use anyhow::{Context, Result};
use chrono::NaiveDate;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct Session {
    pub date: NaiveDate,
    pub exercise: String,
    pub reps: u32,
}

#[derive(Serialize, Deserialize, Debug, Default, PartialEq)]
pub struct ScoresFile {
    pub version: u32,
    pub sessions: Vec<Session>,
}

pub fn default_path() -> Result<PathBuf> {
    let home = dirs::home_dir().context("could not determine home directory")?;
    Ok(home.join(".fitcoding").join("scores.json"))
}

pub fn load(path: &Path) -> Result<ScoresFile> {
    if !path.exists() {
        return Ok(ScoresFile { version: 1, sessions: vec![] });
    }
    let text = fs::read_to_string(path)
        .with_context(|| format!("reading {}", path.display()))?;
    let parsed: ScoresFile = serde_json::from_str(&text)
        .with_context(|| format!("parsing {}", path.display()))?;
    Ok(parsed)
}

pub fn append(path: &Path, session: Session) -> Result<()> {
    let mut current = load(path)?;
    if current.version == 0 {
        current.version = 1;
    }
    current.sessions.push(session);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .with_context(|| format!("creating {}", parent.display()))?;
    }
    let text = serde_json::to_string_pretty(&current)?;
    fs::write(path, text).with_context(|| format!("writing {}", path.display()))?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    fn date(y: i32, m: u32, d: u32) -> NaiveDate {
        NaiveDate::from_ymd_opt(y, m, d).unwrap()
    }

    #[test]
    fn load_returns_empty_when_missing() {
        let tmp = TempDir::new().unwrap();
        let path = tmp.path().join("scores.json");
        let scores = load(&path).unwrap();
        assert_eq!(scores, ScoresFile { version: 1, sessions: vec![] });
    }

    #[test]
    fn append_creates_file_and_dirs() {
        let tmp = TempDir::new().unwrap();
        let path = tmp.path().join("nested").join("scores.json");
        let session = Session { date: date(2026, 5, 3), exercise: "squat".into(), reps: 22 };
        append(&path, session.clone()).unwrap();
        let loaded = load(&path).unwrap();
        assert_eq!(loaded.version, 1);
        assert_eq!(loaded.sessions, vec![session]);
    }

    #[test]
    fn append_preserves_existing_sessions() {
        let tmp = TempDir::new().unwrap();
        let path = tmp.path().join("scores.json");
        let s1 = Session { date: date(2026, 5, 2), exercise: "pushup".into(), reps: 10 };
        let s2 = Session { date: date(2026, 5, 3), exercise: "squat".into(), reps: 15 };
        append(&path, s1.clone()).unwrap();
        append(&path, s2.clone()).unwrap();
        let loaded = load(&path).unwrap();
        assert_eq!(loaded.sessions, vec![s1, s2]);
    }

    #[test]
    fn load_errors_on_garbage_json() {
        let tmp = TempDir::new().unwrap();
        let path = tmp.path().join("scores.json");
        fs::write(&path, "this is not json").unwrap();
        assert!(load(&path).is_err());
    }
}
```

- [ ] **Step 2: Wire the module into main.rs**

Add this line at the top of `app/src-tauri/src/main.rs`, just under the `#![cfg_attr(...)]` line:

```rust
mod scores;
```

- [ ] **Step 3: Run tests**

Run: `cd app/src-tauri && cargo test scores`
Expected: 4 passed, 0 failed.

- [ ] **Step 4: Commit**

```bash
git add app/src-tauri/src/scores.rs app/src-tauri/src/main.rs
git commit -m "feat(scores): JSON load/append with version field"
```

---

### Task 5: Board formatter

**Files:**
- Create: `app/src-tauri/src/board.rs`
- Modify: `app/src-tauri/src/main.rs` (add `mod board;`)

- [ ] **Step 1: Write the failing tests**

Create `app/src-tauri/src/board.rs`:

```rust
use crate::scores::{Session, ScoresFile};
use chrono::{Duration, NaiveDate};
use std::collections::BTreeMap;

const EXERCISES: [&str; 3] = ["squat", "jumping_jack", "pushup"];
const HISTORY_DAYS: i64 = 7;

pub fn format_table(scores: &ScoresFile, today: NaiveDate) -> String {
    let mut totals: BTreeMap<NaiveDate, BTreeMap<&str, u32>> = BTreeMap::new();
    for s in &scores.sessions {
        let exercise = EXERCISES.iter().copied().find(|e| *e == s.exercise);
        let Some(ex) = exercise else { continue };
        *totals.entry(s.date).or_default().entry(ex).or_insert(0) += s.reps;
    }

    let mut out = String::new();
    out.push_str(&format!("{:<8}{:>8}{:>16}{:>10}\n", "", "squat", "jumping_jack", "pushup"));

    let mut grand: BTreeMap<&str, u32> = BTreeMap::new();
    for offset in 0..HISTORY_DAYS {
        let day = today - Duration::days(offset);
        let row = totals.get(&day);
        let mut cells: [String; 3] = std::array::from_fn(|_| String::from("\u{2014}"));
        for (i, ex) in EXERCISES.iter().enumerate() {
            if let Some(r) = row.and_then(|m| m.get(ex)).copied() {
                cells[i] = r.to_string();
                *grand.entry(ex).or_insert(0) += r;
            }
        }
        out.push_str(&format!(
            "{:<8}{:>8}{:>16}{:>10}\n",
            day.format("%m-%d"),
            cells[0], cells[1], cells[2],
        ));
    }
    out.push_str(&format!(
        "{:<8}{:>8}{:>16}{:>10}\n",
        "TOTAL",
        grand.get("squat").copied().unwrap_or(0),
        grand.get("jumping_jack").copied().unwrap_or(0),
        grand.get("pushup").copied().unwrap_or(0),
    ));
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    fn date(y: i32, m: u32, d: u32) -> NaiveDate {
        NaiveDate::from_ymd_opt(y, m, d).unwrap()
    }

    #[test]
    fn empty_scores_renders_seven_em_dash_rows_plus_total() {
        let scores = ScoresFile { version: 1, sessions: vec![] };
        let out = format_table(&scores, date(2026, 5, 3));
        let lines: Vec<&str> = out.lines().collect();
        assert_eq!(lines.len(), 9, "header + 7 days + TOTAL");
        assert!(lines[0].contains("squat"));
        assert!(lines[0].contains("jumping_jack"));
        assert!(lines[0].contains("pushup"));
        assert!(lines[1].contains("05-03"));
        assert!(lines[7].contains("04-27"));
        assert!(lines[8].starts_with("TOTAL"));
    }

    #[test]
    fn sums_multiple_sessions_for_same_day_and_exercise() {
        let scores = ScoresFile {
            version: 1,
            sessions: vec![
                Session { date: date(2026, 5, 3), exercise: "squat".into(), reps: 10 },
                Session { date: date(2026, 5, 3), exercise: "squat".into(), reps: 12 },
                Session { date: date(2026, 5, 3), exercise: "pushup".into(), reps: 5 },
            ],
        };
        let out = format_table(&scores, date(2026, 5, 3));
        let today_row = out.lines().nth(1).unwrap();
        assert!(today_row.contains("22"), "row was: {today_row:?}");
        assert!(today_row.contains("5"));
        let total_row = out.lines().last().unwrap();
        assert!(total_row.contains("22"));
        assert!(total_row.contains("5"));
    }

    #[test]
    fn ignores_unknown_exercises() {
        let scores = ScoresFile {
            version: 1,
            sessions: vec![
                Session { date: date(2026, 5, 3), exercise: "burpee".into(), reps: 99 },
            ],
        };
        let out = format_table(&scores, date(2026, 5, 3));
        assert!(!out.contains("99"));
    }
}
```

- [ ] **Step 2: Wire into main.rs**

Add `mod board;` next to the existing `mod scores;` declaration in `app/src-tauri/src/main.rs`.

- [ ] **Step 3: Run tests**

Run: `cd app/src-tauri && cargo test board`
Expected: 3 passed, 0 failed.

- [ ] **Step 4: Commit**

```bash
git add app/src-tauri/src/board.rs app/src-tauri/src/main.rs
git commit -m "feat(board): scoreboard table formatter"
```

---

### Task 6: Wire `board` subcommand to print real output

**Files:**
- Modify: `app/src-tauri/src/main.rs`

- [ ] **Step 1: Update the `Cmd::Board` arm in `main()`**

Replace the body of the `Cmd::Board` arm in `app/src-tauri/src/main.rs`:

```rust
        Cmd::Board => {
            let path = match scores::default_path() {
                Ok(p) => p,
                Err(e) => {
                    eprintln!("fitcoding: {e}");
                    std::process::exit(1);
                }
            };
            let data = match scores::load(&path) {
                Ok(d) => d,
                Err(e) => {
                    eprintln!("fitcoding: failed to read scores: {e}");
                    std::process::exit(1);
                }
            };
            let today = chrono::Local::now().date_naive();
            print!("{}", board::format_table(&data, today));
        }
```

- [ ] **Step 2: Manual smoke test — empty state**

```bash
cd app/src-tauri
# Make sure no scores file exists for the test user.
rm -f ~/.fitcoding/scores.json   # on Windows: del %USERPROFILE%\.fitcoding\scores.json
cargo run -- board
```

Expected: 9-line table with all em-dashes (—) and TOTAL row of zeros.

- [ ] **Step 3: Manual smoke test — with data**

Manually create `~/.fitcoding/scores.json` with two sessions:

```json
{
  "version": 1,
  "sessions": [
    { "date": "2026-05-03", "exercise": "squat", "reps": 22 },
    { "date": "2026-05-03", "exercise": "pushup", "reps": 7 }
  ]
}
```

Run: `cargo run -- board`
Expected: today's row shows `22` under squat and `7` under pushup; TOTAL row matches.

Cleanup: `rm -f ~/.fitcoding/scores.json` to keep your local state clean.

- [ ] **Step 4: Commit**

```bash
git add app/src-tauri/src/main.rs
git commit -m "feat(cli): board prints real scoreboard from ~/.fitcoding/scores.json"
```

---

### Task 7: Random exercise picker

**Files:**
- Create: `app/src-tauri/src/launch.rs`
- Modify: `app/src-tauri/src/main.rs`

This task only adds the picker function and a stub for `Cmd::Launch`. The actual Tauri window plumbing comes in Task 8.

- [ ] **Step 1: Write the failing tests**

Create `app/src-tauri/src/launch.rs`:

```rust
use rand::seq::SliceRandom;

pub const EXERCISES: [&str; 3] = ["squat", "jumping_jack", "pushup"];

pub fn resolve_exercise(arg: Option<String>) -> &'static str {
    match arg.as_deref() {
        Some("squat") => "squat",
        Some("jumping_jack") => "jumping_jack",
        Some("pushup") => "pushup",
        _ => pick_random(),
    }
}

fn pick_random() -> &'static str {
    let mut rng = rand::thread_rng();
    EXERCISES.choose(&mut rng).copied().unwrap_or("squat")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn explicit_named_exercise_passes_through() {
        assert_eq!(resolve_exercise(Some("squat".into())), "squat");
        assert_eq!(resolve_exercise(Some("jumping_jack".into())), "jumping_jack");
        assert_eq!(resolve_exercise(Some("pushup".into())), "pushup");
    }

    #[test]
    fn random_keyword_picks_one_of_the_known_exercises() {
        let picked = resolve_exercise(Some("random".into()));
        assert!(EXERCISES.contains(&picked));
    }

    #[test]
    fn missing_arg_picks_one_of_the_known_exercises() {
        let picked = resolve_exercise(None);
        assert!(EXERCISES.contains(&picked));
    }
}
```

- [ ] **Step 2: Wire into main.rs and update the launch arm**

In `app/src-tauri/src/main.rs`:
1. Add `mod launch;` next to the other module declarations.
2. Replace the `Cmd::Launch { exercise }` arm body with:

```rust
        Cmd::Launch { exercise } => {
            let chosen = launch::resolve_exercise(exercise);
            println!("(stub) launch chose exercise={chosen}");
        }
```

- [ ] **Step 3: Run tests**

Run: `cd app/src-tauri && cargo test launch`
Expected: 3 passed, 0 failed.

- [ ] **Step 4: Manual smoke test**

```bash
cargo run -- launch --exercise squat   # → (stub) launch chose exercise=squat
cargo run -- launch                    # → exercise={one of the three}, varies between runs
cargo run                              # → same as above (no subcommand defaults to launch)
```

- [ ] **Step 5: Commit**

```bash
git add app/src-tauri/src/launch.rs app/src-tauri/src/main.rs
git commit -m "feat(launch): random exercise picker"
```

---

## Phase 3 — Webview foundation: layout + exercises

### Task 8: Three-panel HTML layout + CSS

**Files:**
- Modify: `app/index.html`
- Modify: `app/src/styles.css`
- Modify: `app/src/main.ts`

- [ ] **Step 1: Replace `app/index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>FitCoding</title>
    <link rel="stylesheet" href="/src/styles.css" />
  </head>
  <body>
    <div id="app">
      <div id="left-panel">
        <canvas id="pixelman" width="240" height="240"></canvas>
        <div id="exercise-name">—</div>
        <div id="form-cue"></div>
      </div>
      <div id="right-panel">
        <video id="cam" autoplay muted playsinline></video>
        <canvas id="skeleton" width="400" height="400"></canvas>
        <div id="hud">
          <div class="hud-stat">reps: <span id="rep-count">0</span></div>
          <div class="hud-stat"><span id="time-left">00:30</span></div>
        </div>
      </div>
      <div id="overlay" class="hidden"></div>
    </div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

- [ ] **Step 2: Replace `app/src/styles.css`**

```css
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body, #app { width: 100%; height: 100%; }
body {
  background: #0a0a0a;
  color: #f0f0f0;
  font-family: -apple-system, "Segoe UI", system-ui, sans-serif;
  overflow: hidden;
}

#app {
  display: grid;
  grid-template-columns: 1fr 1fr;
  position: relative;
}

#left-panel, #right-panel {
  padding: 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
}

#left-panel {
  background: #15171a;
  border-right: 1px solid #2a2d33;
}

#pixelman {
  image-rendering: pixelated;
  image-rendering: crisp-edges;
  width: 240px;
  height: 240px;
  background: #0a0a0a;
}

#exercise-name {
  margin-top: 16px;
  font-size: 22px;
  font-weight: 700;
  letter-spacing: 2px;
  text-transform: uppercase;
}

#form-cue {
  margin-top: 8px;
  font-size: 13px;
  color: #888;
  text-align: center;
  max-width: 240px;
}

#right-panel { position: relative; }
#cam, #skeleton {
  width: 360px;
  height: 360px;
  object-fit: cover;
  border-radius: 8px;
}
#cam { transform: scaleX(-1); }
#skeleton { position: absolute; top: 16px; left: 50%; transform: translateX(-50%); pointer-events: none; }

#hud {
  margin-top: 8px;
  display: flex;
  gap: 24px;
  font-variant-numeric: tabular-nums;
  font-size: 18px;
}
.hud-stat span { font-weight: 700; }

#overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 48px;
  font-weight: 800;
  text-align: center;
  z-index: 10;
}
#overlay.hidden { display: none; }
```

- [ ] **Step 3: Update `app/src/main.ts` to confirm DOM nodes exist**

```ts
const required = [
  "pixelman", "exercise-name", "form-cue",
  "cam", "skeleton", "rep-count", "time-left", "overlay",
];
for (const id of required) {
  if (!document.getElementById(id)) {
    console.error(`missing DOM node #${id}`);
  }
}
console.log("FitCoding webview booted");
```

- [ ] **Step 4: Verify Vite dev server still works**

Run: `cd app && npm run dev`
Open: http://localhost:1420 in a browser. Expected: split-pane layout with empty canvases left and right; console shows `FitCoding webview booted` and no `missing DOM node` errors. Stop with Ctrl+C.

- [ ] **Step 5: Commit**

```bash
git add app/index.html app/src/styles.css app/src/main.ts
git commit -m "feat(ui): three-panel layout (pixelman / webcam / overlay)"
```

---

### Task 9: Joint angle math utility

**Files:**
- Create: `app/src/exercises/angles.ts`
- Create: `app/src/exercises/angles.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `app/src/exercises/angles.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { angleAtVertex, distance } from "./angles";

describe("angleAtVertex", () => {
  it("returns 90 for a perfect right angle", () => {
    const a = { x: 1, y: 0 };
    const v = { x: 0, y: 0 };
    const b = { x: 0, y: 1 };
    expect(angleAtVertex(a, v, b)).toBeCloseTo(90, 5);
  });

  it("returns 180 for collinear points on opposite sides", () => {
    expect(angleAtVertex({ x: -1, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 0 }))
      .toBeCloseTo(180, 5);
  });

  it("returns 0 for collinear points on the same side", () => {
    expect(angleAtVertex({ x: 1, y: 0 }, { x: 0, y: 0 }, { x: 2, y: 0 }))
      .toBeCloseTo(0, 5);
  });

  it("returns 60 for a known 60-degree triangle", () => {
    const a = { x: 1, y: 0 };
    const v = { x: 0, y: 0 };
    const b = { x: Math.cos(Math.PI / 3), y: Math.sin(Math.PI / 3) };
    expect(angleAtVertex(a, v, b)).toBeCloseTo(60, 4);
  });
});

describe("distance", () => {
  it("returns 5 for a 3-4-5 triangle", () => {
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBeCloseTo(5, 5);
  });

  it("returns 0 for identical points", () => {
    expect(distance({ x: 1, y: 1 }, { x: 1, y: 1 })).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `cd app && npx vitest run src/exercises/angles.test.ts`
Expected: 6 failures (cannot resolve `./angles`).

- [ ] **Step 3: Create `app/src/exercises/angles.ts`**

```ts
export interface Point2D {
  x: number;
  y: number;
}

export function distance(a: Point2D, b: Point2D): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Angle in degrees at vertex `v`, formed by rays v→a and v→b.
 * Returns a value in [0, 180].
 */
export function angleAtVertex(a: Point2D, v: Point2D, b: Point2D): number {
  const ax = a.x - v.x;
  const ay = a.y - v.y;
  const bx = b.x - v.x;
  const by = b.y - v.y;
  const dot = ax * bx + ay * by;
  const magA = Math.sqrt(ax * ax + ay * ay);
  const magB = Math.sqrt(bx * bx + by * by);
  if (magA === 0 || magB === 0) return 0;
  const cos = Math.max(-1, Math.min(1, dot / (magA * magB)));
  return (Math.acos(cos) * 180) / Math.PI;
}
```

- [ ] **Step 4: Re-run tests**

Run: `cd app && npx vitest run src/exercises/angles.test.ts`
Expected: 6 passed, 0 failed.

- [ ] **Step 5: Commit**

```bash
git add app/src/exercises/angles.ts app/src/exercises/angles.test.ts
git commit -m "feat(exercises): joint-angle and distance math utilities"
```

---

### Task 10: Exercise interface & types

**Files:**
- Create: `app/src/exercises/types.ts`
- Create: `app/src/pose/types.ts`

- [ ] **Step 1: Create `app/src/pose/types.ts`**

This file is used by both `pose/` and `exercises/`. The numeric IDs match the MediaPipe Pose Landmarker landmark indices.

```ts
export interface Landmark {
  x: number;          // normalized [0, 1] in image-space
  y: number;          // normalized [0, 1]
  z: number;
  visibility: number; // [0, 1] — confidence the joint is visible
}

export type PoseLandmarks = Landmark[];

// MediaPipe Pose Landmarker landmark indices (subset we use).
export const LM = {
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
} as const;
```

- [ ] **Step 2: Create `app/src/exercises/types.ts`**

```ts
import type { PoseLandmarks } from "../pose/types";

export type RepPhase = "ready" | "down" | "up";

export interface RepState {
  reps: number;
  phase: RepPhase;
  /** 0..1: how far through the rep cycle the body currently is. */
  progress: number;
}

export interface ExerciseModule {
  /** Stable internal name, e.g. "squat". */
  name: string;
  /** Short string shown in the pixel-man panel under the sprite. */
  formCue: string;
  /** Reset counters for a fresh 30s session. */
  reset(): void;
  /** Consume the latest pose and return current rep state. */
  update(landmarks: PoseLandmarks): RepState;
}
```

- [ ] **Step 3: Verify nothing breaks**

Run: `cd app && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/src/pose/types.ts app/src/exercises/types.ts
git commit -m "feat(exercises): types — Landmark, RepPhase, ExerciseModule"
```

---

### Task 11: Squat exercise module

**Files:**
- Create: `app/src/exercises/squat.ts`
- Create: `app/src/exercises/squat.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `app/src/exercises/squat.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { createSquat } from "./squat";
import { LM } from "../pose/types";
import type { Landmark } from "../pose/types";

function landmarksWithKneeAngle(angleDeg: number): Landmark[] {
  // Build a synthetic body where the right leg has the requested hip-knee-ankle angle.
  // Hip at (0, 0), knee at (0, 1) (straight down). Ankle is angleDeg below the leg axis.
  const arr: Landmark[] = Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0, visibility: 1 }));
  const hip = { x: 0, y: 0 };
  const knee = { x: 0, y: 1 };
  // Ankle direction: rotate downward (0,1) by (180 - angle) around the knee.
  // For angle=180, ankle is straight further down (0,2). For angle=90, ankle is to the side (1,1).
  const theta = ((180 - angleDeg) * Math.PI) / 180;
  const ankle = {
    x: knee.x + Math.sin(theta),
    y: knee.y + Math.cos(theta),
  };
  arr[LM.RIGHT_HIP] = { ...hip, z: 0, visibility: 1 };
  arr[LM.RIGHT_KNEE] = { ...knee, z: 0, visibility: 1 };
  arr[LM.RIGHT_ANKLE] = { ...ankle, z: 0, visibility: 1 };
  // Mirror to left side so module averaging works.
  arr[LM.LEFT_HIP] = { ...hip, z: 0, visibility: 1 };
  arr[LM.LEFT_KNEE] = { ...knee, z: 0, visibility: 1 };
  arr[LM.LEFT_ANKLE] = { ...ankle, z: 0, visibility: 1 };
  return arr;
}

describe("createSquat", () => {
  let mod: ReturnType<typeof createSquat>;
  beforeEach(() => { mod = createSquat(); });

  it("starts in 'ready' with zero reps", () => {
    const initial = mod.update(landmarksWithKneeAngle(170));
    expect(initial.reps).toBe(0);
    expect(initial.phase).toBe("up");
  });

  it("counts a rep on a full down→up cycle", () => {
    mod.update(landmarksWithKneeAngle(170)); // up
    let r = mod.update(landmarksWithKneeAngle(110)); // down (≤120)
    expect(r.phase).toBe("down");
    expect(r.reps).toBe(0);
    r = mod.update(landmarksWithKneeAngle(160)); // up (>150)
    expect(r.phase).toBe("up");
    expect(r.reps).toBe(1);
  });

  it("does not count partial squats above the down threshold", () => {
    mod.update(landmarksWithKneeAngle(170));
    mod.update(landmarksWithKneeAngle(135)); // didn't reach 120
    const r = mod.update(landmarksWithKneeAngle(170));
    expect(r.reps).toBe(0);
  });

  it("counts multiple reps", () => {
    mod.update(landmarksWithKneeAngle(170));
    for (let i = 0; i < 3; i++) {
      mod.update(landmarksWithKneeAngle(110));
      mod.update(landmarksWithKneeAngle(160));
    }
    const r = mod.update(landmarksWithKneeAngle(160));
    expect(r.reps).toBe(3);
  });

  it("progress is 0 at fully extended and 1 at deep squat", () => {
    const upProgress = mod.update(landmarksWithKneeAngle(160)).progress;
    const downProgress = mod.update(landmarksWithKneeAngle(110)).progress;
    expect(upProgress).toBeCloseTo(0, 1);
    expect(downProgress).toBeCloseTo(1, 1);
  });

  it("reset clears reps and phase", () => {
    mod.update(landmarksWithKneeAngle(170));
    mod.update(landmarksWithKneeAngle(110));
    mod.update(landmarksWithKneeAngle(160));
    expect(mod.update(landmarksWithKneeAngle(160)).reps).toBe(1);
    mod.reset();
    expect(mod.update(landmarksWithKneeAngle(160)).reps).toBe(0);
  });
});
```

- [ ] **Step 2: Run, verify failures**

Run: `cd app && npx vitest run src/exercises/squat.test.ts`
Expected: 6 failures (cannot resolve `./squat`).

- [ ] **Step 3: Implement `app/src/exercises/squat.ts`**

```ts
import { angleAtVertex } from "./angles";
import type { ExerciseModule, RepState, RepPhase } from "./types";
import { LM } from "../pose/types";
import type { PoseLandmarks } from "../pose/types";

const DOWN_THRESHOLD = 120;
const UP_THRESHOLD = 150;

export function createSquat(): ExerciseModule {
  let reps = 0;
  let phase: RepPhase = "ready";

  return {
    name: "squat",
    formCue: "Bend the knees, keep your back straight",
    reset() {
      reps = 0;
      phase = "ready";
    },
    update(landmarks: PoseLandmarks): RepState {
      const hipL = landmarks[LM.LEFT_HIP];
      const kneeL = landmarks[LM.LEFT_KNEE];
      const ankleL = landmarks[LM.LEFT_ANKLE];
      const hipR = landmarks[LM.RIGHT_HIP];
      const kneeR = landmarks[LM.RIGHT_KNEE];
      const ankleR = landmarks[LM.RIGHT_ANKLE];

      const angleL = angleAtVertex(hipL, kneeL, ankleL);
      const angleR = angleAtVertex(hipR, kneeR, ankleR);
      const angle = (angleL + angleR) / 2;

      const progress = clamp01((UP_THRESHOLD - angle) / (UP_THRESHOLD - DOWN_THRESHOLD));

      if (angle < DOWN_THRESHOLD) {
        phase = "down";
      } else if (angle > UP_THRESHOLD) {
        if (phase === "down") {
          reps += 1;
        }
        phase = "up";
      }

      return { reps, phase, progress };
    },
  };
}

function clamp01(x: number): number {
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}
```

- [ ] **Step 4: Re-run tests**

Run: `cd app && npx vitest run src/exercises/squat.test.ts`
Expected: 6 passed, 0 failed.

- [ ] **Step 5: Commit**

```bash
git add app/src/exercises/squat.ts app/src/exercises/squat.test.ts
git commit -m "feat(exercises): squat rep counter (hip-knee-ankle angle)"
```

---

### Task 12: Push-up exercise module

**Files:**
- Create: `app/src/exercises/pushup.ts`
- Create: `app/src/exercises/pushup.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `app/src/exercises/pushup.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { createPushup } from "./pushup";
import { LM } from "../pose/types";
import type { Landmark } from "../pose/types";

function landmarksWithElbowAngle(angleDeg: number): Landmark[] {
  // Shoulder at (0,0), elbow at (0,1). Wrist rotated to form the requested angle at the elbow.
  const arr: Landmark[] = Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0, visibility: 1 }));
  const shoulder = { x: 0, y: 0 };
  const elbow = { x: 0, y: 1 };
  const theta = ((180 - angleDeg) * Math.PI) / 180;
  const wrist = {
    x: elbow.x + Math.sin(theta),
    y: elbow.y + Math.cos(theta),
  };
  arr[LM.RIGHT_SHOULDER] = { ...shoulder, z: 0, visibility: 1 };
  arr[LM.RIGHT_ELBOW] = { ...elbow, z: 0, visibility: 1 };
  arr[LM.RIGHT_WRIST] = { ...wrist, z: 0, visibility: 1 };
  arr[LM.LEFT_SHOULDER] = { ...shoulder, z: 0, visibility: 1 };
  arr[LM.LEFT_ELBOW] = { ...elbow, z: 0, visibility: 1 };
  arr[LM.LEFT_WRIST] = { ...wrist, z: 0, visibility: 1 };
  return arr;
}

describe("createPushup", () => {
  let mod: ReturnType<typeof createPushup>;
  beforeEach(() => { mod = createPushup(); });

  it("counts a full down→up cycle", () => {
    mod.update(landmarksWithElbowAngle(170)); // up
    expect(mod.update(landmarksWithElbowAngle(100)).phase).toBe("down");
    const r = mod.update(landmarksWithElbowAngle(160));
    expect(r.phase).toBe("up");
    expect(r.reps).toBe(1);
  });

  it("does not count partial reps above the down threshold", () => {
    mod.update(landmarksWithElbowAngle(170));
    mod.update(landmarksWithElbowAngle(120)); // didn't reach 110
    expect(mod.update(landmarksWithElbowAngle(170)).reps).toBe(0);
  });

  it("counts five reps", () => {
    mod.update(landmarksWithElbowAngle(170));
    for (let i = 0; i < 5; i++) {
      mod.update(landmarksWithElbowAngle(100));
      mod.update(landmarksWithElbowAngle(160));
    }
    expect(mod.update(landmarksWithElbowAngle(160)).reps).toBe(5);
  });

  it("reset clears reps", () => {
    mod.update(landmarksWithElbowAngle(170));
    mod.update(landmarksWithElbowAngle(100));
    mod.update(landmarksWithElbowAngle(160));
    mod.reset();
    expect(mod.update(landmarksWithElbowAngle(160)).reps).toBe(0);
  });
});
```

- [ ] **Step 2: Implement `app/src/exercises/pushup.ts`**

```ts
import { angleAtVertex } from "./angles";
import type { ExerciseModule, RepState, RepPhase } from "./types";
import { LM } from "../pose/types";
import type { PoseLandmarks } from "../pose/types";

const DOWN_THRESHOLD = 110;
const UP_THRESHOLD = 150;

export function createPushup(): ExerciseModule {
  let reps = 0;
  let phase: RepPhase = "ready";

  return {
    name: "pushup",
    formCue: "Lower until elbows ~90°, keep your body straight",
    reset() {
      reps = 0;
      phase = "ready";
    },
    update(landmarks: PoseLandmarks): RepState {
      const angleL = angleAtVertex(
        landmarks[LM.LEFT_SHOULDER],
        landmarks[LM.LEFT_ELBOW],
        landmarks[LM.LEFT_WRIST],
      );
      const angleR = angleAtVertex(
        landmarks[LM.RIGHT_SHOULDER],
        landmarks[LM.RIGHT_ELBOW],
        landmarks[LM.RIGHT_WRIST],
      );
      const angle = (angleL + angleR) / 2;
      const progress = clamp01((UP_THRESHOLD - angle) / (UP_THRESHOLD - DOWN_THRESHOLD));

      if (angle < DOWN_THRESHOLD) {
        phase = "down";
      } else if (angle > UP_THRESHOLD) {
        if (phase === "down") {
          reps += 1;
        }
        phase = "up";
      }

      return { reps, phase, progress };
    },
  };
}

function clamp01(x: number): number {
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}
```

- [ ] **Step 3: Run tests**

Run: `cd app && npx vitest run src/exercises/pushup.test.ts`
Expected: 4 passed, 0 failed.

- [ ] **Step 4: Commit**

```bash
git add app/src/exercises/pushup.ts app/src/exercises/pushup.test.ts
git commit -m "feat(exercises): pushup rep counter (shoulder-elbow-wrist angle)"
```

---

### Task 13: Jumping-jack exercise module

**Files:**
- Create: `app/src/exercises/jumping_jack.ts`
- Create: `app/src/exercises/jumping_jack.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `app/src/exercises/jumping_jack.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { createJumpingJack } from "./jumping_jack";
import { LM } from "../pose/types";
import type { Landmark } from "../pose/types";

interface Geom {
  shoulderWidth: number;
  hipWidth: number;
  wristGap: number;
  ankleGap: number;
}

function landmarksWithGeom(g: Geom): Landmark[] {
  const arr: Landmark[] = Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0, visibility: 1 }));
  const sw = g.shoulderWidth / 2;
  const hw = g.hipWidth / 2;
  const wg = g.wristGap / 2;
  const ag = g.ankleGap / 2;
  arr[LM.LEFT_SHOULDER] = { x: -sw, y: 0, z: 0, visibility: 1 };
  arr[LM.RIGHT_SHOULDER] = { x: sw, y: 0, z: 0, visibility: 1 };
  arr[LM.LEFT_HIP] = { x: -hw, y: 1, z: 0, visibility: 1 };
  arr[LM.RIGHT_HIP] = { x: hw, y: 1, z: 0, visibility: 1 };
  arr[LM.LEFT_WRIST] = { x: -wg, y: -0.5, z: 0, visibility: 1 };
  arr[LM.RIGHT_WRIST] = { x: wg, y: -0.5, z: 0, visibility: 1 };
  arr[LM.LEFT_ANKLE] = { x: -ag, y: 2, z: 0, visibility: 1 };
  arr[LM.RIGHT_ANKLE] = { x: ag, y: 2, z: 0, visibility: 1 };
  return arr;
}

const closed = (): Landmark[] => landmarksWithGeom({
  shoulderWidth: 0.2, hipWidth: 0.2, wristGap: 0.18, ankleGap: 0.18,
});

const opened = (): Landmark[] => landmarksWithGeom({
  shoulderWidth: 0.2, hipWidth: 0.2, wristGap: 0.30, ankleGap: 0.30,
});

const halfway = (): Landmark[] => landmarksWithGeom({
  shoulderWidth: 0.2, hipWidth: 0.2, wristGap: 0.24, ankleGap: 0.24,
});

describe("createJumpingJack", () => {
  let mod: ReturnType<typeof createJumpingJack>;
  beforeEach(() => { mod = createJumpingJack(); });

  it("counts a full closed→open cycle", () => {
    mod.update(closed()); // closed phase set
    const r = mod.update(opened());
    expect(r.phase).toBe("up");
    expect(r.reps).toBe(1);
  });

  it("does not count partial movement", () => {
    mod.update(closed());
    mod.update(halfway());
    expect(mod.update(closed()).reps).toBe(0);
  });

  it("counts three reps", () => {
    mod.update(closed());
    for (let i = 0; i < 3; i++) {
      mod.update(opened());
      mod.update(closed());
    }
    expect(mod.update(opened()).reps).toBe(3);
  });

  it("progress reflects ratio between closed and open thresholds", () => {
    expect(mod.update(closed()).progress).toBeLessThanOrEqual(0);
    expect(mod.update(opened()).progress).toBeGreaterThanOrEqual(1);
  });

  it("reset clears reps", () => {
    mod.update(closed());
    mod.update(opened());
    mod.reset();
    expect(mod.update(opened()).reps).toBe(0);
  });
});
```

- [ ] **Step 2: Implement `app/src/exercises/jumping_jack.ts`**

```ts
import { distance } from "./angles";
import type { ExerciseModule, RepState, RepPhase } from "./types";
import { LM } from "../pose/types";
import type { PoseLandmarks } from "../pose/types";

const CLOSED_RATIO = 1.1;
const OPEN_RATIO = 1.3;

export function createJumpingJack(): ExerciseModule {
  let reps = 0;
  let phase: RepPhase = "ready";

  return {
    name: "jumping_jack",
    formCue: "Arms up, feet out, then back together",
    reset() {
      reps = 0;
      phase = "ready";
    },
    update(landmarks: PoseLandmarks): RepState {
      const shoulderWidth = distance(landmarks[LM.LEFT_SHOULDER], landmarks[LM.RIGHT_SHOULDER]);
      const hipWidth = distance(landmarks[LM.LEFT_HIP], landmarks[LM.RIGHT_HIP]);
      const wristGap = distance(landmarks[LM.LEFT_WRIST], landmarks[LM.RIGHT_WRIST]);
      const ankleGap = distance(landmarks[LM.LEFT_ANKLE], landmarks[LM.RIGHT_ANKLE]);

      const wristRatio = shoulderWidth > 0 ? wristGap / shoulderWidth : 0;
      const ankleRatio = hipWidth > 0 ? ankleGap / hipWidth : 0;
      const ratio = (wristRatio + ankleRatio) / 2;

      const progress = clamp01((ratio - CLOSED_RATIO) / (OPEN_RATIO - CLOSED_RATIO));

      // We reuse the up/down phase names: "down" = closed, "up" = open.
      if (wristRatio < CLOSED_RATIO && ankleRatio < CLOSED_RATIO) {
        phase = "down";
      } else if (wristRatio > OPEN_RATIO && ankleRatio > OPEN_RATIO) {
        if (phase === "down") {
          reps += 1;
        }
        phase = "up";
      }

      return { reps, phase, progress };
    },
  };
}

function clamp01(x: number): number {
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}
```

- [ ] **Step 3: Run tests**

Run: `cd app && npx vitest run src/exercises/jumping_jack.test.ts`
Expected: 5 passed, 0 failed.

- [ ] **Step 4: Run all exercise tests together**

Run: `cd app && npx vitest run src/exercises`
Expected: 21 passed, 0 failed (6 angles + 6 squat + 4 pushup + 5 jumping_jack).

- [ ] **Step 5: Commit**

```bash
git add app/src/exercises/jumping_jack.ts app/src/exercises/jumping_jack.test.ts
git commit -m "feat(exercises): jumping_jack rep counter (limb-spread ratios)"
```

---

### Task 14: Exercise registry

**Files:**
- Create: `app/src/exercises/index.ts`

- [ ] **Step 1: Create `app/src/exercises/index.ts`**

```ts
import { createSquat } from "./squat";
import { createJumpingJack } from "./jumping_jack";
import { createPushup } from "./pushup";
import type { ExerciseModule } from "./types";

export type ExerciseName = "squat" | "jumping_jack" | "pushup";

export function createExercise(name: ExerciseName): ExerciseModule {
  switch (name) {
    case "squat": return createSquat();
    case "jumping_jack": return createJumpingJack();
    case "pushup": return createPushup();
  }
}

export function isExerciseName(s: string): s is ExerciseName {
  return s === "squat" || s === "jumping_jack" || s === "pushup";
}

export type { ExerciseModule } from "./types";
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd app && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/src/exercises/index.ts
git commit -m "feat(exercises): registry — createExercise(name) factory"
```

---

## Phase 4 — Pose detection

### Task 15: MediaPipe Pose Landmarker wrapper

**Files:**
- Create: `app/src/pose/index.ts`

The MediaPipe Tasks API loads its WASM and model files from a URL. We use the official CDN for simplicity; this means the app needs network access on first launch (the model is cached by the OS afterwards). A fully offline build would bundle the assets — defer that to v2.

- [ ] **Step 1: Create `app/src/pose/index.ts`**

```ts
import {
  PoseLandmarker,
  FilesetResolver,
} from "@mediapipe/tasks-vision";
import type { PoseLandmarks } from "./types";

const WASM_BASE = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";

export interface Pose {
  detect(video: HTMLVideoElement, timestampMs: number): PoseLandmarks | null;
  close(): void;
}

export async function initPose(): Promise<Pose> {
  const fileset = await FilesetResolver.forVisionTasks(WASM_BASE);
  const landmarker = await PoseLandmarker.createFromOptions(fileset, {
    baseOptions: {
      modelAssetPath: MODEL_URL,
      delegate: "GPU",
    },
    runningMode: "VIDEO",
    numPoses: 1,
    minPoseDetectionConfidence: 0.5,
    minPosePresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });

  return {
    detect(video: HTMLVideoElement, timestampMs: number): PoseLandmarks | null {
      if (video.readyState < 2) return null;
      const result = landmarker.detectForVideo(video, timestampMs);
      const first = result.landmarks[0];
      if (!first) return null;
      return first.map((lm) => ({
        x: lm.x,
        y: lm.y,
        z: lm.z,
        visibility: lm.visibility ?? 0,
      }));
    },
    close() {
      landmarker.close();
    },
  };
}
```

- [ ] **Step 2: TypeScript check**

Run: `cd app && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/src/pose/index.ts
git commit -m "feat(pose): mediapipe pose-landmarker wrapper"
```

---

### Task 16: Webcam panel (getUserMedia + skeleton overlay)

**Files:**
- Create: `app/src/ui/webcam.ts`

Pure DOM/canvas code, no unit tests — verified manually via the Vite dev server in Task 23.

- [ ] **Step 1: Create `app/src/ui/webcam.ts`**

```ts
import type { PoseLandmarks } from "../pose/types";

const SKELETON_EDGES: ReadonlyArray<readonly [number, number]> = [
  [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],          // arms
  [11, 23], [12, 24], [23, 24],                              // torso
  [23, 25], [25, 27], [24, 26], [26, 28],                    // legs
];

export interface Webcam {
  video: HTMLVideoElement;
  start(): Promise<void>;
  drawSkeleton(landmarks: PoseLandmarks | null): void;
  stop(): void;
}

export function createWebcam(
  videoEl: HTMLVideoElement,
  overlayCanvas: HTMLCanvasElement,
): Webcam {
  const ctx = overlayCanvas.getContext("2d");
  if (!ctx) throw new Error("could not get 2d context");
  let stream: MediaStream | null = null;

  return {
    video: videoEl,

    async start() {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: "user" },
        audio: false,
      });
      videoEl.srcObject = stream;
      await videoEl.play();
    },

    drawSkeleton(landmarks: PoseLandmarks | null) {
      const w = overlayCanvas.width;
      const h = overlayCanvas.height;
      ctx.clearRect(0, 0, w, h);
      if (!landmarks) return;

      // Mirror to match the mirrored video.
      ctx.save();
      ctx.translate(w, 0);
      ctx.scale(-1, 1);

      ctx.strokeStyle = "#62e08a";
      ctx.lineWidth = 3;
      for (const [a, b] of SKELETON_EDGES) {
        const la = landmarks[a];
        const lb = landmarks[b];
        if (!la || !lb) continue;
        if (la.visibility < 0.3 || lb.visibility < 0.3) continue;
        ctx.beginPath();
        ctx.moveTo(la.x * w, la.y * h);
        ctx.lineTo(lb.x * w, lb.y * h);
        ctx.stroke();
      }

      ctx.fillStyle = "#62e08a";
      for (const lm of landmarks) {
        if (lm.visibility < 0.3) continue;
        ctx.beginPath();
        ctx.arc(lm.x * w, lm.y * h, 4, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    },

    stop() {
      stream?.getTracks().forEach((t) => t.stop());
      stream = null;
      videoEl.srcObject = null;
    },
  };
}
```

- [ ] **Step 2: TypeScript check**

Run: `cd app && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/src/ui/webcam.ts
git commit -m "feat(ui): webcam component with skeleton overlay drawing"
```

---

### Task 17: Pixel-man canvas

**Files:**
- Create: `app/src/ui/pixelman.ts`
- Create: `app/src/ui/pixelman.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `app/src/ui/pixelman.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { progressToFrame } from "./pixelman";

describe("progressToFrame", () => {
  it("returns 0 at progress 0", () => {
    expect(progressToFrame(0, 4)).toBe(0);
  });
  it("returns frameCount-1 at progress 1", () => {
    expect(progressToFrame(1, 4)).toBe(3);
  });
  it("returns 2 at progress 0.5 with 4 frames", () => {
    expect(progressToFrame(0.5, 4)).toBe(2);
  });
  it("clamps progress > 1 to last frame", () => {
    expect(progressToFrame(1.7, 4)).toBe(3);
  });
  it("clamps negative progress to first frame", () => {
    expect(progressToFrame(-0.4, 4)).toBe(0);
  });
});
```

- [ ] **Step 2: Run, verify failures**

Run: `cd app && npx vitest run src/ui/pixelman.test.ts`
Expected: 5 failures (cannot resolve `./pixelman`).

- [ ] **Step 3: Create `app/src/ui/pixelman.ts`**

```ts
const FRAME_COUNT = 4;
const FRAME_SIZE = 64;

export function progressToFrame(progress: number, frames: number = FRAME_COUNT): number {
  const clamped = Math.max(0, Math.min(1, progress));
  const idx = Math.floor(clamped * frames);
  return Math.min(frames - 1, idx);
}

export interface PixelMan {
  setSpriteUrl(url: string): Promise<void>;
  draw(progress: number): void;
}

export function createPixelMan(canvas: HTMLCanvasElement): PixelMan {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("could not get 2d context");
  ctx.imageSmoothingEnabled = false;
  let sprite: HTMLImageElement | null = null;

  return {
    async setSpriteUrl(url: string) {
      sprite = await loadImage(url);
    },
    draw(progress: number) {
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);
      if (!sprite) return;
      const frame = progressToFrame(progress);
      const sx = frame * FRAME_SIZE;
      ctx.drawImage(sprite, sx, 0, FRAME_SIZE, FRAME_SIZE, 0, 0, w, h);
    },
  };
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`failed to load ${url}`));
    img.src = url;
  });
}
```

- [ ] **Step 4: Run tests**

Run: `cd app && npx vitest run src/ui/pixelman.test.ts`
Expected: 5 passed, 0 failed.

- [ ] **Step 5: Commit**

```bash
git add app/src/ui/pixelman.ts app/src/ui/pixelman.test.ts
git commit -m "feat(ui): pixelman sprite canvas (frame index from progress)"
```

---

### Task 18: Timer + countdown

**Files:**
- Create: `app/src/ui/timer.ts`
- Create: `app/src/ui/timer.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `app/src/ui/timer.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { formatRemaining } from "./timer";

describe("formatRemaining", () => {
  it("formats whole seconds", () => {
    expect(formatRemaining(30_000)).toBe("00:30");
    expect(formatRemaining(7_000)).toBe("00:07");
  });
  it("rounds up partial seconds so 0 doesn't appear early", () => {
    expect(formatRemaining(30_500)).toBe("00:31");
    expect(formatRemaining(1)).toBe("00:01");
  });
  it("formats zero as 00:00 even on small negative inputs", () => {
    expect(formatRemaining(0)).toBe("00:00");
    expect(formatRemaining(-50)).toBe("00:00");
  });
});
```

- [ ] **Step 2: Run, verify failures**

Run: `cd app && npx vitest run src/ui/timer.test.ts`
Expected: 3 failures.

- [ ] **Step 3: Create `app/src/ui/timer.ts`**

```ts
export function formatRemaining(ms: number): string {
  const safe = Math.max(0, ms);
  const seconds = Math.ceil(safe / 1000);
  const mm = Math.floor(seconds / 60).toString().padStart(2, "0");
  const ss = (seconds % 60).toString().padStart(2, "0");
  return `${mm}:${ss}`;
}

export interface CountdownHandle {
  cancel(): void;
  promise: Promise<void>;
}

/** Run a 3-2-1-GO countdown, calling onTick with each label. Resolves after GO. */
export function runIntroCountdown(onTick: (label: string) => void): CountdownHandle {
  const labels = ["3", "2", "1", "GO!"];
  let cancelled = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const promise = new Promise<void>((resolve) => {
    let i = 0;
    const tick = () => {
      if (cancelled) return resolve();
      if (i >= labels.length) return resolve();
      onTick(labels[i]!);
      i += 1;
      timer = setTimeout(tick, 700);
    };
    tick();
  });

  return {
    cancel() {
      cancelled = true;
      if (timer) clearTimeout(timer);
    },
    promise,
  };
}

export interface SessionTimerHandle {
  cancel(): void;
  promise: Promise<void>;
}

/**
 * Run a session timer for `durationMs` ms.
 * Calls onTick about 10x/second with the remaining ms.
 */
export function runSessionTimer(
  durationMs: number,
  onTick: (remainingMs: number) => void,
): SessionTimerHandle {
  let cancelled = false;
  const start = performance.now();
  let raf = 0;
  const promise = new Promise<void>((resolve) => {
    const loop = () => {
      if (cancelled) return resolve();
      const elapsed = performance.now() - start;
      const remaining = Math.max(0, durationMs - elapsed);
      onTick(remaining);
      if (remaining <= 0) return resolve();
      raf = requestAnimationFrame(loop);
    };
    loop();
  });
  return {
    cancel() {
      cancelled = true;
      cancelAnimationFrame(raf);
    },
    promise,
  };
}
```

- [ ] **Step 4: Run tests**

Run: `cd app && npx vitest run src/ui/timer.test.ts`
Expected: 3 passed, 0 failed.

- [ ] **Step 5: Commit**

```bash
git add app/src/ui/timer.ts app/src/ui/timer.test.ts
git commit -m "feat(ui): timer utilities — formatRemaining + countdown + session"
```

---

### Task 19: Overlay (countdown text + final score screen)

**Files:**
- Create: `app/src/ui/overlay.ts`

- [ ] **Step 1: Create `app/src/ui/overlay.ts`**

```ts
export interface Overlay {
  showText(text: string): void;
  showScore(exercise: string, reps: number): void;
  hide(): void;
}

const PRETTY_NAMES: Record<string, string> = {
  squat: "squats",
  jumping_jack: "jumping jacks",
  pushup: "push-ups",
};

export function createOverlay(el: HTMLElement): Overlay {
  return {
    showText(text: string) {
      el.textContent = text;
      el.classList.remove("hidden");
    },
    showScore(exercise: string, reps: number) {
      const label = PRETTY_NAMES[exercise] ?? exercise;
      el.textContent = `Congrats! ${reps} ${label} in 30s`;
      el.classList.remove("hidden");
    },
    hide() {
      el.textContent = "";
      el.classList.add("hidden");
    },
  };
}
```

- [ ] **Step 2: TypeScript check**

Run: `cd app && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/src/ui/overlay.ts
git commit -m "feat(ui): overlay component for countdown + final score"
```

---

## Phase 5 — Tauri IPC + main.ts wiring

### Task 20: Tauri IPC for picked exercise + score finalization

**Files:**
- Modify: `app/src-tauri/src/launch.rs`
- Modify: `app/src-tauri/src/main.rs`
- Modify: `app/src-tauri/tauri.conf.json` (no changes anticipated, but verify CSP allows webview to call commands)

- [ ] **Step 1: Replace the body of `launch.rs` with the Tauri-aware version**

Edit `app/src-tauri/src/launch.rs` — keep `EXERCISES`, `resolve_exercise`, and the existing tests; add new code for the Tauri commands and the `run` entry point.

```rust
use crate::scores::{self, Session};
use anyhow::Result;
use chrono::Local;
use rand::seq::SliceRandom;
use std::sync::Mutex;
use tauri::{Manager, State};

pub const EXERCISES: [&str; 3] = ["squat", "jumping_jack", "pushup"];

pub fn resolve_exercise(arg: Option<String>) -> &'static str {
    match arg.as_deref() {
        Some("squat") => "squat",
        Some("jumping_jack") => "jumping_jack",
        Some("pushup") => "pushup",
        _ => pick_random(),
    }
}

fn pick_random() -> &'static str {
    let mut rng = rand::thread_rng();
    EXERCISES.choose(&mut rng).copied().unwrap_or("squat")
}

struct AppState {
    chosen_exercise: Mutex<&'static str>,
}

#[tauri::command]
fn get_exercise(state: State<'_, AppState>) -> String {
    state.chosen_exercise.lock().unwrap().to_string()
}

#[tauri::command]
fn save_score(exercise: String, reps: u32) -> Result<(), String> {
    let path = scores::default_path().map_err(|e| e.to_string())?;
    let session = Session {
        date: Local::now().date_naive(),
        exercise,
        reps,
    };
    scores::append(&path, session).map_err(|e| e.to_string())
}

pub fn run(chosen: &'static str) {
    tauri::Builder::default()
        .manage(AppState { chosen_exercise: Mutex::new(chosen) })
        .invoke_handler(tauri::generate_handler![get_exercise, save_score])
        .setup(|app| {
            // Reveal the window now that state is ready (it's hidden in tauri.conf.json).
            if let Some(window) = app.get_webview_window("main") {
                window.show().ok();
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn explicit_named_exercise_passes_through() {
        assert_eq!(resolve_exercise(Some("squat".into())), "squat");
        assert_eq!(resolve_exercise(Some("jumping_jack".into())), "jumping_jack");
        assert_eq!(resolve_exercise(Some("pushup".into())), "pushup");
    }

    #[test]
    fn random_keyword_picks_one_of_the_known_exercises() {
        let picked = resolve_exercise(Some("random".into()));
        assert!(EXERCISES.contains(&picked));
    }

    #[test]
    fn missing_arg_picks_one_of_the_known_exercises() {
        let picked = resolve_exercise(None);
        assert!(EXERCISES.contains(&picked));
    }
}
```

- [ ] **Step 2: Update the `Cmd::Launch` arm in `main.rs` to call `launch::run`**

Replace the `Cmd::Launch { exercise }` arm body:

```rust
        Cmd::Launch { exercise } => {
            let chosen = launch::resolve_exercise(exercise);
            launch::run(chosen);
        }
```

- [ ] **Step 3: Verify Rust still compiles**

Run: `cd app/src-tauri && cargo build`
Expected: builds successfully (Tauri build script will pull WebView2 / WebKit deps the first time — this can take several minutes).

- [ ] **Step 4: Run Rust tests**

Run: `cargo test`
Expected: previous tests still pass (3 launch + 4 scores + 3 board + 5 cli = 15).

- [ ] **Step 5: Commit**

```bash
git add app/src-tauri/src/launch.rs app/src-tauri/src/main.rs
git commit -m "feat(tauri): get_exercise + save_score IPC commands"
```

---

### Task 21: IPC client wrapper + main.ts orchestration

**Files:**
- Create: `app/src/ipc.ts`
- Replace: `app/src/main.ts`

- [ ] **Step 1: Create `app/src/ipc.ts`**

```ts
import { invoke } from "@tauri-apps/api/core";

export async function getExercise(): Promise<string> {
  return invoke<string>("get_exercise");
}

export async function saveScore(exercise: string, reps: number): Promise<void> {
  await invoke("save_score", { exercise, reps });
}
```

- [ ] **Step 2: Replace `app/src/main.ts`**

```ts
import { initPose } from "./pose";
import { createWebcam } from "./ui/webcam";
import { createPixelMan } from "./ui/pixelman";
import { createOverlay } from "./ui/overlay";
import { runIntroCountdown, runSessionTimer, formatRemaining } from "./ui/timer";
import { createExercise, isExerciseName } from "./exercises";
import { getExercise, saveScore } from "./ipc";

const SESSION_DURATION_MS = 30_000;

async function main() {
  const camEl = document.getElementById("cam") as HTMLVideoElement;
  const skeletonEl = document.getElementById("skeleton") as HTMLCanvasElement;
  const pixelEl = document.getElementById("pixelman") as HTMLCanvasElement;
  const overlayEl = document.getElementById("overlay") as HTMLDivElement;
  const nameEl = document.getElementById("exercise-name")!;
  const cueEl = document.getElementById("form-cue")!;
  const repCountEl = document.getElementById("rep-count")!;
  const timeLeftEl = document.getElementById("time-left")!;

  const exerciseName = await getExercise();
  if (!isExerciseName(exerciseName)) {
    overlayEl.textContent = `unknown exercise: ${exerciseName}`;
    overlayEl.classList.remove("hidden");
    return;
  }

  const exercise = createExercise(exerciseName);
  nameEl.textContent = exerciseName.replace("_", " ");
  cueEl.textContent = exercise.formCue;

  const overlay = createOverlay(overlayEl);
  const pixelMan = createPixelMan(pixelEl);
  const webcam = createWebcam(camEl, skeletonEl);

  await pixelMan.setSpriteUrl(`/src/assets/sprites/${exerciseName}.png`);
  pixelMan.draw(0);

  overlay.showText("Allow camera access to begin");
  try {
    await webcam.start();
  } catch (e) {
    overlay.showText("Camera permission denied — close window to retry");
    return;
  }

  overlay.showText("Loading model…");
  const pose = await initPose();
  overlay.hide();

  await runIntroCountdown((label) => overlay.showText(label)).promise;
  overlay.hide();

  let lastReps = 0;
  let frameTimestamp = 0;

  const session = runSessionTimer(SESSION_DURATION_MS, (remaining) => {
    timeLeftEl.textContent = formatRemaining(remaining);
    frameTimestamp += 33; // approximate; pose only needs monotonically increasing values
    const landmarks = pose.detect(camEl, frameTimestamp);
    if (!landmarks) {
      cueEl.textContent = "Step into frame";
      return;
    }
    cueEl.textContent = exercise.formCue;
    webcam.drawSkeleton(landmarks);
    const state = exercise.update(landmarks);
    pixelMan.draw(state.progress);
    if (state.reps !== lastReps) {
      lastReps = state.reps;
      repCountEl.textContent = String(state.reps);
    }
  });

  await session.promise;

  pose.close();
  webcam.stop();

  try {
    await saveScore(exerciseName, lastReps);
  } catch (e) {
    console.error("save_score failed:", e);
  }

  overlay.showScore(exerciseName, lastReps);
  setTimeout(() => {
    window.close();
  }, 3000);
}

main().catch((e) => {
  console.error(e);
  const el = document.getElementById("overlay");
  if (el) {
    el.textContent = `Error: ${e?.message ?? e}`;
    el.classList.remove("hidden");
  }
});
```

- [ ] **Step 3: TypeScript check**

Run: `cd app && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/src/ipc.ts app/src/main.ts
git commit -m "feat(ui): main.ts orchestration — pose loop + ipc + overlays"
```

---

## Phase 6 — Plugin manifest & bootstrap scripts

### Task 22: Plugin manifest + slash command file

**Files:**
- Create: `.claude-plugin/plugin.json`
- Create: `.claude-plugin/commands/fit.md`

- [ ] **Step 1: Create `.claude-plugin/plugin.json`**

```json
{
  "name": "fitcoding",
  "version": "0.0.1",
  "description": "/fit pops a 30-second exercise mini-game; /fit board prints the daily scoreboard.",
  "author": "AndrewWayne",
  "license": "MIT",
  "homepage": "https://github.com/AndrewWayne/FitCoding"
}
```

- [ ] **Step 2: Create `.claude-plugin/commands/fit.md`**

```markdown
---
description: Pop a 30s exercise mini-game (no args) or print today's scoreboard (with `board`).
allowed-tools: Bash
---

!`bash "${CLAUDE_PLUGIN_ROOT}/scripts/fit.sh" $ARGUMENTS`
```

The shell `!`-prefix tells Claude Code to execute the command and inline its stdout. `${CLAUDE_PLUGIN_ROOT}` is provided by Claude Code at runtime to point at the plugin's root directory. On Windows we still rely on bash; if the user has WSL or Git Bash on PATH this works. (The PowerShell variant in `fit.ps1` is for users invoking the binary directly outside Claude Code.)

- [ ] **Step 3: Commit**

```bash
git add .claude-plugin/plugin.json .claude-plugin/commands/fit.md
git commit -m "feat(plugin): plugin.json and /fit slash-command file"
```

---

### Task 23: Unix bootstrap script (fit.sh)

**Files:**
- Create: `.claude-plugin/scripts/fit.sh`

- [ ] **Step 1: Create `.claude-plugin/scripts/fit.sh`**

```bash
#!/usr/bin/env bash
set -euo pipefail

VERSION="${FITCODING_VERSION:-latest}"
INSTALL_DIR="${HOME}/.fitcoding/bin"
BIN="${INSTALL_DIR}/fitcoding"

detect_target() {
  local os arch
  os="$(uname -s)"
  arch="$(uname -m)"
  case "${os}-${arch}" in
    Darwin-arm64)        echo "aarch64-apple-darwin" ;;
    Darwin-x86_64)       echo "x86_64-apple-darwin" ;;
    Linux-x86_64)        echo "x86_64-unknown-linux-gnu" ;;
    *)
      echo "fitcoding: unsupported platform ${os}/${arch}" >&2
      exit 1
      ;;
  esac
}

ensure_binary() {
  if [ -x "${BIN}" ]; then
    return
  fi
  local target url
  target="$(detect_target)"
  if [ "${VERSION}" = "latest" ]; then
    url="https://github.com/AndrewWayne/FitCoding/releases/latest/download/fitcoding-${target}.tar.gz"
  else
    url="https://github.com/AndrewWayne/FitCoding/releases/download/${VERSION}/fitcoding-${target}.tar.gz"
  fi
  echo "Downloading FitCoding binary for ${target}..." >&2
  mkdir -p "${INSTALL_DIR}"
  local tmp
  tmp="$(mktemp -t fitcoding-XXXXXX.tar.gz)"
  curl -fsSL "${url}" -o "${tmp}"
  tar -xzf "${tmp}" -C "${INSTALL_DIR}"
  rm -f "${tmp}"
  chmod +x "${BIN}"
}

dispatch() {
  case "${1:-}" in
    "")
      # /fit → spawn detached so the slash command returns immediately.
      nohup "${BIN}" launch >/dev/null 2>&1 &
      disown || true
      echo "FitCoding window launching..."
      ;;
    "board")
      exec "${BIN}" board
      ;;
    *)
      echo "Usage: /fit          (start a 30s exercise)" >&2
      echo "       /fit board    (print today's scoreboard)" >&2
      exit 1
      ;;
  esac
}

ensure_binary
dispatch "$@"
```

- [ ] **Step 2: Mark executable**

Run: `chmod +x .claude-plugin/scripts/fit.sh`

- [ ] **Step 3: Smoke test (dry run with bad arg)**

Run: `.claude-plugin/scripts/fit.sh garbage` (on Unix, or Git Bash on Windows)
Expected: Usage message printed to stderr, exit code 1. (On Windows without bash, skip this step.)

- [ ] **Step 4: Commit**

```bash
git add .claude-plugin/scripts/fit.sh
git update-index --chmod=+x .claude-plugin/scripts/fit.sh
git commit -m "feat(plugin): fit.sh bootstrap (download binary + dispatch)"
```

---

### Task 24: Windows bootstrap script (fit.ps1)

**Files:**
- Create: `.claude-plugin/scripts/fit.ps1`

- [ ] **Step 1: Create `.claude-plugin/scripts/fit.ps1`**

```powershell
#Requires -Version 5.1
[CmdletBinding()]
param(
    [Parameter(Position=0)]
    [string]$Subcommand
)

$ErrorActionPreference = "Stop"

$Version    = if ($env:FITCODING_VERSION) { $env:FITCODING_VERSION } else { "latest" }
$InstallDir = Join-Path $env:USERPROFILE ".fitcoding\bin"
$Bin        = Join-Path $InstallDir "fitcoding.exe"

function Get-Target {
    $arch = (Get-CimInstance Win32_OperatingSystem).OSArchitecture
    if ($arch -like "*64-bit*") {
        return "x86_64-pc-windows-msvc"
    }
    throw "fitcoding: unsupported Windows architecture $arch"
}

function Ensure-Binary {
    if (Test-Path $Bin) { return }
    $target = Get-Target
    $url = if ($Version -eq "latest") {
        "https://github.com/AndrewWayne/FitCoding/releases/latest/download/fitcoding-$target.zip"
    } else {
        "https://github.com/AndrewWayne/FitCoding/releases/download/$Version/fitcoding-$target.zip"
    }
    Write-Host "Downloading FitCoding binary for $target..."
    New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
    $tmp = New-TemporaryFile
    $zip = "$($tmp.FullName).zip"
    Move-Item $tmp.FullName $zip
    Invoke-WebRequest -Uri $url -OutFile $zip -UseBasicParsing
    Expand-Archive -Path $zip -DestinationPath $InstallDir -Force
    Remove-Item $zip
}

function Dispatch {
    switch ($Subcommand) {
        "" {
            Start-Process -WindowStyle Hidden -FilePath $Bin -ArgumentList "launch"
            Write-Host "FitCoding window launching..."
        }
        "board" {
            & $Bin board
            exit $LASTEXITCODE
        }
        Default {
            Write-Error "Usage: /fit          (start a 30s exercise)`n       /fit board    (print today's scoreboard)"
            exit 1
        }
    }
}

Ensure-Binary
Dispatch
```

- [ ] **Step 2: Commit**

```bash
git add .claude-plugin/scripts/fit.ps1
git commit -m "feat(plugin): fit.ps1 windows bootstrap"
```

---

## Phase 7 — Sprites, CI/release, README

### Task 25: Placeholder sprite assets

**Files:**
- Create: `app/src/assets/sprites/squat.png`
- Create: `app/src/assets/sprites/jumping_jack.png`
- Create: `app/src/assets/sprites/pushup.png`

The sprites are 256×64 PNGs (4 frames × 64×64). For v0.0.1 we ship simple stick-figure placeholders so the pipeline runs end-to-end; final pixel art is a v0.0.2 polish task.

- [ ] **Step 1: Generate placeholder sprites**

Pick one of the following:

(a) Manual: open Aseprite or any pixel editor, draw 4 frames of a stick figure per exercise into a 256×64 transparent PNG. Save the three files at the paths above.

(b) Scripted (no art tool needed): create `scripts/gen-sprites.py` and run it. Drop this file at `scripts/gen-sprites.py`:

```python
"""Generate placeholder 256x64 sprite sheets for v0.0.1."""
from pathlib import Path
from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parents[1] / "app" / "src" / "assets" / "sprites"
OUT.mkdir(parents=True, exist_ok=True)

def stick(draw: ImageDraw.ImageDraw, ox: int, *, head_y: int, knee_y: int, arms_up: bool):
    color = (240, 240, 240, 255)
    # head
    draw.ellipse([ox + 28, head_y, ox + 36, head_y + 8], fill=color)
    # body
    draw.line([(ox + 32, head_y + 8), (ox + 32, head_y + 28)], fill=color, width=2)
    # arms
    arm_y = head_y + 12
    arm_lift = -10 if arms_up else 8
    draw.line([(ox + 32, arm_y), (ox + 22, arm_y + arm_lift)], fill=color, width=2)
    draw.line([(ox + 32, arm_y), (ox + 42, arm_y + arm_lift)], fill=color, width=2)
    # legs
    draw.line([(ox + 32, head_y + 28), (ox + 26, knee_y)], fill=color, width=2)
    draw.line([(ox + 32, head_y + 28), (ox + 38, knee_y)], fill=color, width=2)

def squat_frames():
    img = Image.new("RGBA", (256, 64), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # 4 frames of progressive descent
    for i, ky in enumerate([56, 48, 44, 40]):
        stick(d, i * 64, head_y=12 + i * 2, knee_y=ky, arms_up=False)
    img.save(OUT / "squat.png")

def jumping_jack_frames():
    img = Image.new("RGBA", (256, 64), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    for i, up in enumerate([False, True, False, True]):
        stick(d, i * 64, head_y=12, knee_y=56, arms_up=up)
    img.save(OUT / "jumping_jack.png")

def pushup_frames():
    img = Image.new("RGBA", (256, 64), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # Horizontal stick figure with elbow bend variation
    color = (240, 240, 240, 255)
    for i, lift in enumerate([0, -3, -6, -3]):
        ox = i * 64
        # head
        d.ellipse([ox + 8, 28 + lift, ox + 16, 36 + lift], fill=color)
        # body
        d.line([(ox + 16, 32 + lift), (ox + 52, 32 + lift)], fill=color, width=2)
        # arm
        d.line([(ox + 24, 32 + lift), (ox + 24, 48)], fill=color, width=2)
        # leg
        d.line([(ox + 52, 32 + lift), (ox + 56, 48)], fill=color, width=2)
    img.save(OUT / "pushup.png")

if __name__ == "__main__":
    squat_frames()
    jumping_jack_frames()
    pushup_frames()
    print("wrote", *(p.name for p in OUT.glob("*.png")))
```

Then run: `pip install pillow && python scripts/gen-sprites.py`

- [ ] **Step 2: Verify the three PNGs exist**

Run: `ls app/src/assets/sprites/`
Expected: `squat.png`, `jumping_jack.png`, `pushup.png`.

- [ ] **Step 3: Commit (binary assets)**

```bash
git add app/src/assets/sprites/squat.png app/src/assets/sprites/jumping_jack.png app/src/assets/sprites/pushup.png
# commit the generator too if you used option (b)
[ -f scripts/gen-sprites.py ] && git add scripts/gen-sprites.py
git commit -m "feat(assets): placeholder 4-frame sprite sheets for v0.0.1"
```

---

### Task 26: GitHub Actions release workflow

**Files:**
- Create: `.github/workflows/release.yml`

- [ ] **Step 1: Create `.github/workflows/release.yml`**

```yaml
name: Release

on:
  push:
    tags:
      - "v*.*.*"

permissions:
  contents: write

jobs:
  build:
    strategy:
      fail-fast: false
      matrix:
        include:
          - os: windows-latest
            target: x86_64-pc-windows-msvc
            archive: zip
            ext: ".exe"
          - os: macos-14
            target: aarch64-apple-darwin
            archive: tar.gz
            ext: ""
          - os: macos-13
            target: x86_64-apple-darwin
            archive: tar.gz
            ext: ""
          - os: ubuntu-22.04
            target: x86_64-unknown-linux-gnu
            archive: tar.gz
            ext: ""

    runs-on: ${{ matrix.os }}
    steps:
      - uses: actions/checkout@v4

      - name: Install Linux build deps
        if: matrix.os == 'ubuntu-22.04'
        run: |
          sudo apt-get update
          sudo apt-get install -y libwebkit2gtk-4.1-dev build-essential curl wget file libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev

      - uses: actions/setup-node@v4
        with:
          node-version: "20"

      - uses: dtolnay/rust-toolchain@stable
        with:
          targets: ${{ matrix.target }}

      - name: Install frontend deps
        working-directory: app
        run: npm ci

      - name: Build frontend
        working-directory: app
        run: npm run build

      - name: Build Rust binary
        working-directory: app/src-tauri
        run: cargo build --release --target ${{ matrix.target }}

      - name: Package archive
        shell: bash
        run: |
          set -euo pipefail
          BIN_NAME="fitcoding${{ matrix.ext }}"
          SRC="app/src-tauri/target/${{ matrix.target }}/release/${BIN_NAME}"
          STAGE="dist/fitcoding-${{ matrix.target }}"
          mkdir -p "${STAGE}"
          cp "${SRC}" "${STAGE}/"
          cp LICENSE "${STAGE}/"
          cp README.md "${STAGE}/"
          if [ "${{ matrix.archive }}" = "zip" ]; then
            (cd dist && 7z a "fitcoding-${{ matrix.target }}.zip" "fitcoding-${{ matrix.target }}/*")
          else
            tar -czf "dist/fitcoding-${{ matrix.target }}.tar.gz" -C dist "fitcoding-${{ matrix.target }}"
          fi

      - uses: actions/upload-artifact@v4
        with:
          name: fitcoding-${{ matrix.target }}
          path: dist/fitcoding-${{ matrix.target }}.*

  release:
    needs: build
    runs-on: ubuntu-22.04
    steps:
      - uses: actions/download-artifact@v4
        with:
          path: dist
          merge-multiple: true

      - uses: softprops/action-gh-release@v2
        with:
          files: dist/*
          generate_release_notes: true
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/release.yml
git commit -m "ci: release workflow — multi-os matrix build + github release"
```

---

### Task 27: README

**Files:**
- Create: `README.md`

- [ ] **Step 1: Create `README.md`**

````markdown
# FitCoding

Get up. Stand up. Stand up for your reps.

A Claude Code plugin: while Claude is thinking, type `/fit` to interrupt yourself with a 30-second exercise mini-game. Squat, jumping jack, or push-up — webcam pose detection counts your reps. After 30s the window auto-closes; `/fit board` prints your daily scoreboard.

## Install

```
/plugin install AndrewWayne/FitCoding
```

The first time you run `/fit`, a small native binary (~10–20 MB) is downloaded from this repo's GitHub Releases into `~/.fitcoding/bin/` and reused after that.

### macOS

The bundled binary is unsigned. After first launch, if macOS blocks it:

```
xattr -d com.apple.quarantine ~/.fitcoding/bin/fitcoding
```

You'll also see a one-time camera-permission prompt — grant it; the model runs locally.

### Windows

SmartScreen may show a "Windows protected your PC" notice on the very first run. Click _More info → Run anyway_.

### Linux

Requires WebKit2GTK 4.1 (`libwebkit2gtk-4.1-0` on Debian/Ubuntu).

## Usage

| Command       | What it does                                          |
|---------------|-------------------------------------------------------|
| `/fit`        | Pops a window, picks a random exercise, runs 30s      |
| `/fit board`  | Prints today + last 7 days as a small terminal table  |

Scores are stored in `~/.fitcoding/scores.json`.

## Privacy

The webcam stream stays on your machine. The pose model (`pose_landmarker_lite.task`) is downloaded from Google's MediaPipe model storage on first launch and cached by the OS. No telemetry is sent anywhere.

## License

MIT — see [`LICENSE`](./LICENSE).
````

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: README — install + usage + permissions notes"
```

---

### Task 28: End-to-end smoke test

This task has no file changes — it's a manual checklist before tagging v0.0.1.

- [ ] **Step 1: Confirm all unit tests pass**

```bash
cd app && npx vitest run
cd app/src-tauri && cargo test
```

Expected: all green. Total ≥ 26 tests across both suites.

- [ ] **Step 2: Run a full `npm run tauri dev`**

```bash
cd app && npm run tauri dev
```

Expected: a frameless window opens, prompts for camera permission, shows 3-2-1 countdown, then 30 seconds of live skeleton overlay + rep counting (try whichever exercise was randomly picked), then a "Congrats! N exercises in 30s" overlay, then auto-closes.

- [ ] **Step 3: Verify the score landed**

```bash
cat ~/.fitcoding/scores.json
```

Expected: a valid JSON file with at least one session entry whose `reps` matches what you saw in the overlay.

- [ ] **Step 4: Run the board CLI**

```bash
cd app/src-tauri && cargo run --release -- board
```

Expected: today's row contains your reps from Step 3 under the matching exercise column.

- [ ] **Step 5: Test all three exercises explicitly**

```bash
cargo run --release -- launch --exercise squat        # do squats
cargo run --release -- launch --exercise jumping_jack # do jacks
cargo run --release -- launch --exercise pushup       # do push-ups
cargo run --release -- board                          # all three columns populated
```

- [ ] **Step 6: Test `/fit board` via the bootstrap script**

On Unix:
```bash
.claude-plugin/scripts/fit.sh board
```

Expected: same output as `cargo run -- board`.

On Windows:
```powershell
.\.claude-plugin\scripts\fit.ps1 board
```

Expected: same output.

- [ ] **Step 7: Tag the release**

If everything passes:

```bash
git tag v0.0.1
git push origin main
git push origin v0.0.1
```

The GitHub Actions workflow takes over and produces the four platform binaries on the `v0.0.1` release page. Verify the assets show up before announcing.

---

## Spec coverage check

This plan implements every section of the spec:

| Spec section                              | Covered by tasks |
|-------------------------------------------|------------------|
| §2 Goals — `/fit` window                  | 2, 7, 20, 21     |
| §2 Goals — `/fit board`                   | 5, 6, 23–24      |
| §2 Goals — cross-platform                 | 26               |
| §3.1 User flow — random pick              | 7                |
| §3.1 User flow — countdown                | 18, 19, 21       |
| §3.1 User flow — 30s + auto-close         | 18, 21           |
| §3.1 User flow — score saved              | 4, 20, 21        |
| §3.2 User flow — board                    | 5, 6             |
| §4 Architecture                           | 2, 20            |
| §5.1 Plugin manifest + arg routing        | 22, 23, 24       |
| §5.2 CLI (clap, branch on argv)           | 3, 6, 7          |
| §5.3 Webview frontend — pose              | 15               |
| §5.3 Webview frontend — exercises         | 9–14             |
| §5.3 Webview frontend — UI                | 8, 16, 17, 18, 19 |
| §6 Data model                             | 4                |
| §7.1 Build matrix                         | 26               |
| §7.2 First-run download                   | 23, 24           |
| §8 Risks (camera, OOF, sprite art, etc.)  | 21 (OOF hint), 25 (sprites), 27 (camera/SmartScreen docs) |

No gaps.
