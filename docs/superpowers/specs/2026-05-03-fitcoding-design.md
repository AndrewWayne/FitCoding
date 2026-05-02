# FitCoding — Design Spec

**Date:** 2026-05-03
**Status:** Draft → pending user review
**Repo:** `git@github.com:AndrewWayne/FitCoding.git`

## 1. Problem

Coders sit too long while waiting for the agent to finish thinking. We want a frictionless way to do a quick burst of exercise without leaving the terminal. The trigger should be a single keystroke and the activity should be short, gamified, and enforced (i.e. you can't just type "I did it").

## 2. Goals & Non-Goals

**Goals (v1):**

- Ship a Claude Code plugin installable from a public GitHub repo.
- `/fit` opens a small native-feeling window, picks a random exercise, runs a 30-second challenge with live rep counting via webcam pose detection, then auto-closes and saves the score.
- `/fit board` prints today's totals plus the last 7 days from a local JSON file as a terminal table.
- Cross-platform: Windows x64, macOS (arm64 + x64), Linux x64.

**Non-goals (v1):**

- No cloud sync, no user accounts, no multi-device scoreboard.
- No streaks, personal bests, or social features.
- No exercises beyond squat / jumping jack / push-up.
- No code-signed Mac binaries (user runs `xattr -d com.apple.quarantine` on first launch).
- No mobile app, no companion server.

## 3. User Flows

### 3.1 `/fit` — exercise challenge

1. User types `/fit` in Claude Code (any time, even mid-task).
2. The slash command's bootstrap script (see §7.2) ensures the `fitcoding` binary is installed, then spawns `fitcoding launch` **detached** and exits immediately so Claude is never blocked.
3. `fitcoding launch` (no `--exercise` arg) picks a random exercise from `[squat, jumping_jack, pushup]` and opens the Tauri window directly — no further subprocess.
4. Tauri window appears, frameless, always-on-top, ~800×500, centered. Webview loads, requests camera. On first launch only, the OS shows its native camera-permission prompt; the user must grant it.
5. Once camera is live, MediaPipe Pose Landmarker initializes. Window shows a 3-2-1 countdown.
6. 30-second challenge runs. Per frame: extract 33 landmarks → exercise state machine → maybe increment rep → update UI (rep count, timer, pixel-man frame).
7. At t=30s: overlay "Congrats! N <exercise>s in 30s" appears, score appended to `~/.fitcoding/scores.json`, window auto-closes after 3s.

### 3.2 `/fit board` — scoreboard

1. User types `/fit board`.
2. Slash command runs `fitcoding board`, captures stdout.
3. CLI reads `~/.fitcoding/scores.json`, prints a small table to stdout, exits:

```
        squat   jumping_jack   pushup
05-03   47      30             —
05-02   22      —              15
05-01   —       —              —
...
TOTAL   69      30             15
```

4. Claude Code shows the output in the terminal. No window opens.

## 4. Architecture

```
┌──────────────────────────────────────────────────────────────┐
│ Claude Code                                                  │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ Plugin: .claude-plugin/                                │  │
│  │   commands/fit.md  ──► shell: `fitcoding <args>`       │  │
│  └────────────────────────────────────────────────────────┘  │
└────────────────────────────┬─────────────────────────────────┘
                             │
                  spawned detached
                             │
                             ▼
┌──────────────────────────────────────────────────────────────┐
│ `fitcoding` (single Rust binary, Tauri-based)                │
│                                                              │
│  subcommand `launch`:                                        │
│    - parse --exercise (or random)                            │
│    - open Tauri window                                       │
│    - serve frontend assets                                   │
│    - on score event: append to ~/.fitcoding/scores.json      │
│                                                              │
│  subcommand `board`:                                         │
│    - read ~/.fitcoding/scores.json                           │
│    - format table                                            │
│    - print to stdout, exit                                   │
└──────────────────────────────┬───────────────────────────────┘
                               │ webview IPC
                               ▼
┌──────────────────────────────────────────────────────────────┐
│ Webview frontend (Vite + vanilla TS)                         │
│  - pose/         MediaPipe Pose Landmarker wrapper           │
│  - exercises/    squat.ts, jumping_jack.ts, pushup.ts        │
│                  (state machines: angles → reps)             │
│  - ui/           left pixel-man canvas, right cam panel,     │
│                  overlay scoreboard, countdown               │
│  - assets/sprites/  4-frame PNG sprite sheets per exercise   │
└──────────────────────────────────────────────────────────────┘
```

## 5. Components

### 5.1 Plugin manifest & slash-command routing

`.claude-plugin/` at repo root (the directory Claude Code expects). The plugin manifest declares the plugin name, version, and command list. Single command file `commands/fit.md` invokes the bootstrap script `scripts/fit.sh` (Unix) or `scripts/fit.ps1` (Windows) with `$ARGUMENTS` passed through.

The bootstrap maps slash-command arguments to CLI subcommands:

| User types     | Bootstrap action                                          |
|----------------|-----------------------------------------------------------|
| `/fit`         | spawn `fitcoding launch` **detached**, exit immediately   |
| `/fit board`   | exec `fitcoding board` (synchronous, stdout flows back)   |
| anything else  | print one-line usage, exit 1                              |

Note that v1 has no `/fit squat` slash-command surface — the CLI's `--exercise <name>` flag is for testing/development only and is not exposed via the slash command.

### 5.2 `fitcoding` CLI binary (Rust)

- One Tauri-based binary, two subcommands (clap):
  - `launch [--exercise random|squat|jumping_jack|pushup]` (default: `random`)
  - `board`
- The `launch` path is the only one that opens a Tauri window. `board` runs as plain CLI — no window — by short-circuiting before Tauri's app builder runs. (Tauri allows this: a normal Rust `main` that branches on argv before calling `tauri::Builder`.)
- Score persistence is on the Rust side. Webview emits a `score-finalized` IPC event with `{exercise, reps}`; Rust appends `{date, exercise, reps}` to `~/.fitcoding/scores.json` (creating the file/dir if absent). Date is the local date in `YYYY-MM-DD`.

### 5.3 Webview frontend

Vite project, vanilla TypeScript. Bundle is loaded by Tauri at runtime.

**`pose/`** — Wraps `@mediapipe/tasks-vision`'s `PoseLandmarker` with a single async `init()` and a synchronous per-frame `detect(videoElement) → landmarks`. WASM assets bundled into the Tauri build.

**`exercises/<name>.ts`** — One module per exercise. Each exports:
```ts
export type RepPhase = "ready" | "down" | "up";
export interface ExerciseModule {
  name: string;
  formCue: string;             // shown in the pixel-man panel
  reset(): void;
  update(landmarks: Landmark[]): {
    reps: number;
    phase: RepPhase;
    progress: number;          // 0..1, how far into the rep cycle the body is
  };
}
```

`progress` is a normalized scalar derived from the same joint angle that drives `phase`: 0 when the user is fully in the "up" position, 1 when fully in "down" (or vice versa for jumping_jack: 0 = closed, 1 = fully open). The pixel-man canvas picks sprite frame `floor(progress * 4)` so the sprite tracks the user's tempo continuously across 4 frames per rep, not just at the two phase flips.

State machines for v1 (lenient defaults — partial-ROM reps still count, since the goal is "interrupt sedentary work for 30s," not enforce gym form):
- **squat**: hip-knee angle. `down` when angle < 120°, `up` when > 150°. Rep on down→up transition. `progress = clamp((150° − angle) / (150° − 120°), 0, 1)`.
- **jumping_jack**: wrist-distance ÷ shoulder-width AND ankle-distance ÷ hip-width. `open` when both ratios > 1.3×, `closed` when both < 1.1×. Rep on closed→open transition. `progress` is the average of the two ratios, clamped and normalized to `[1.1×, 1.3×]`.
- **pushup**: elbow angle. `down` when angle < 110°, `up` when > 150°. Rep on down→up transition. `progress = clamp((150° − angle) / (150° − 110°), 0, 1)`.

`phase: "ready"` is the initial state before the first rep is detected — used by the UI to show "GO!" until the first transition.

Thresholds exposed as constants at the top of each module so they can be tuned without surgery.

**`ui/`** — Three regions:
- Left panel: `<canvas>` rendering the pixel-man sprite sheet, frame advanced when `phase` flips (so the sprite mirrors the user's tempo).
- Right panel: `<video>` mirrored, with a `<canvas>` overlay drawing the pose skeleton. Below: `reps: N` and `00:NN left`.
- Overlay: countdown ("3 / 2 / 1 / GO!") and final score screen ("Congrats! N squats in 30s").

**`assets/sprites/`** — Three PNG sprite sheets, 4 frames horizontally, ~64×64 per frame. v1 sprites can be AI-generated (Aseprite-style) or hand-drawn. They live in the repo, not downloaded at runtime.

## 6. Data model

`~/.fitcoding/scores.json`:

```json
{
  "version": 1,
  "sessions": [
    { "date": "2026-05-03", "exercise": "squat", "reps": 22 },
    { "date": "2026-05-03", "exercise": "squat", "reps": 25 }
  ]
}
```

Each `/fit` run appends one entry. The board view groups by date and exercise, summing reps. `version: 1` future-proofs the schema.

## 7. Distribution

### 7.1 Build matrix

GitHub Actions on tag push (`v*.*.*`):

| Target                    | Runner          | Output             |
|---------------------------|-----------------|--------------------|
| `x86_64-pc-windows-msvc`  | windows-latest  | `fitcoding.exe`    |
| `aarch64-apple-darwin`    | macos-14        | `fitcoding`        |
| `x86_64-apple-darwin`     | macos-13        | `fitcoding`        |
| `x86_64-unknown-linux-gnu`| ubuntu-22.04    | `fitcoding`        |

Mac binaries ship unsigned. Windows ships unsigned (SmartScreen warning documented in README). Linux ships as a plain ELF.

Each binary is uploaded as a GitHub Release asset with a deterministic name: `fitcoding-<target>.tar.gz` (or `.zip` on Windows).

### 7.2 Plugin install + first-run binary fetch

When the user installs the plugin via Claude Code's marketplace, only the slash-command file ships in the plugin repo. The actual `fitcoding` binary is fetched on first invocation:

1. The slash command is implemented as a small bootstrap shell script (`fit.sh` for Unix, `fit.ps1` for Windows). Both ship in the plugin repo.
2. On invocation: check `~/.fitcoding/bin/fitcoding(.exe)`. If absent, detect platform, download from `https://github.com/AndrewWayne/FitCoding/releases/latest/download/fitcoding-<target>.tar.gz`, extract, mark executable.
3. Print a one-line progress note ("Downloading FitCoding binary for <platform>…"); the download is ~10–20 MB and takes a few seconds on a normal connection.
4. After install, dispatch per the routing table in §5.1: spawn-and-detach for `launch`, exec for `board`. Detach mechanism per platform: `nohup fitcoding launch >/dev/null 2>&1 &` on Unix; `Start-Process -WindowStyle Hidden fitcoding launch` on Windows.

The plugin manifest's `commands/fit.md` invokes the bootstrap script so the slash command itself is platform-agnostic.

## 8. Risks & open issues

- **Mac camera permission.** TCC dialog must appear on first launch; the Tauri webview triggers `getUserMedia()`, which routes through the OS prompt. README must call this out explicitly.
- **Pose accuracy under poor conditions.** Bad lighting, occlusion, partial body in frame — counts will be off. Mitigation: if pose confidence < threshold for >2s, show "step into frame" hint and pause counting.
- **First-run download UX.** ~10–20MB download on the first `/fit` run. The bootstrap script prints progress but the slash-command output may not stream in real time depending on Claude Code internals. Acceptable for v1; revisit if it feels broken in practice.
- **Sprite art bottleneck.** Three sprite sheets needed before v1 ships. Plan: AI-generate first pass (Aseprite-style 64×64×4), iterate manually if they look bad.
- **Always-on-top + multi-monitor.** Tauri supports it but behavior across virtual desktops on Windows is sometimes flaky. Acceptable to revisit if a user reports an issue.
- **Detached spawn correctness.** `/fit` must not block Claude Code. Verify on all three OSes that the bootstrap script returns immediately while the Tauri process keeps running.

## 9. Out of scope (v2 candidates)

- Streak counter and personal-best tracking.
- More exercises (lunge, burpee, plank with hold timer).
- HIIT mode (sequencer cycling between exercises on a 30s+10s rest pattern).
- Cloud scoreboard / friends leaderboard.
- Code-signed Mac/Windows binaries.
- Configuration file (custom session length, preferred exercises).

## 10. Repo layout (planned)

```
FitCoding/
├── .claude-plugin/
│   ├── plugin.json
│   ├── commands/
│   │   └── fit.md
│   └── scripts/
│       ├── fit.sh
│       └── fit.ps1
├── app/
│   ├── src-tauri/
│   │   ├── src/
│   │   │   ├── main.rs          # argv branch: launch | board
│   │   │   ├── launch.rs        # tauri::Builder + IPC handlers
│   │   │   └── board.rs         # read JSON, print table
│   │   ├── Cargo.toml
│   │   └── tauri.conf.json
│   ├── src/                     # webview frontend
│   │   ├── index.html
│   │   ├── main.ts
│   │   ├── pose/
│   │   ├── exercises/
│   │   ├── ui/
│   │   └── assets/sprites/
│   ├── package.json
│   └── vite.config.ts
├── docs/
│   └── superpowers/specs/
│       └── 2026-05-03-fitcoding-design.md   ← this doc
├── .github/
│   └── workflows/
│       └── release.yml
├── CLAUDE.md
├── README.md
├── LICENSE                      # MIT
└── .gitignore
```
