# FitCoding

Get up. Stand up. Stand up for your reps.

A Claude Code plugin: while Claude is thinking, type `/fit` to interrupt yourself with a 30-second exercise mini-game. Squat, jumping jack, or push-up — webcam pose detection counts your reps. After 30s the window auto-closes; `/fit board` prints your daily scoreboard inline.

**Status:** v0.0.4 · Windows x64 only (Linux + macOS arm64: build from source — see [Other platforms](#other-platforms))

## Prerequisites

| Need | Why | Install (Windows) |
|---|---|---|
| **Git Bash** | The slash command runs `bash` (Claude Code's shell shim on Windows). Git for Windows bundles `bash`. | [git-scm.com/download/win](https://git-scm.com/download/win) (already installed if you use `git`) |
| **`jq`** | The bypass hook (which lets `/fit` fire while Claude is mid-task) parses Claude Code's JSON-over-stdin via `jq`. Without it, `/fit` falls back to the model-routed path (still works, just queues behind whatever Claude is doing). | `winget install jqlang.jq` then **restart your Claude Code session** so the new PATH is inherited. |
| **Webcam + camera permission** | Pose detection runs in the local webview. The first launch triggers the OS camera-permission prompt — grant it. The model and frames stay on your machine. | n/a (Windows native) |

Webview2 is preinstalled on Windows 10 1903+ and Windows 11.

## Install

In your Claude Code session:

```
/plugin marketplace add AndrewWayne/FitCoding
/plugin install fitcoding
/reload-plugins
```

The first invocation of `/fit` downloads a ~6 MB binary from this repo's [GitHub Releases](https://github.com/AndrewWayne/FitCoding/releases) into `~/.fitcoding/bin/fitcoding.exe` and reuses it after that. SmartScreen may show a "Windows protected your PC" notice on the very first launch — click _More info → Run anyway_.

## Usage

| Command | Effect |
|---|---|
| `/fitcoding:fit` (or `/fit` literal) | Pops the Tauri window, picks a random exercise, runs 30s, auto-closes. |
| `/fitcoding:fit board` (or `/fit board`) | Prints today + last 7 days as a small terminal table inline in the chat. |

**Bypass mode**: with `jq` installed and the plugin loaded, typing `/fit` is intercepted at Claude Code's input layer by a `UserPromptSubmit` hook. The shell script runs immediately, the prompt is blocked from reaching Claude, and the window pops up regardless of whether Claude is mid-task. This is the "interrupt yourself for a quick exercise" use case — no waiting for Claude to finish.

Without `jq`, the slash command path runs instead — same end result (window opens), but the prompt routes through Claude first, so it queues if Claude is already busy.

Scores are stored locally at `~/.fitcoding/scores.json`.

## Other platforms

The CI release matrix is Windows-only in v0.0.4. Linux and macOS arm64 builds compile clean locally but the GitHub Actions versions need debugging — multi-OS returns in v0.0.5 once that's resolved.

To build and install from source on macOS or Linux:

```bash
git clone https://github.com/AndrewWayne/FitCoding && cd FitCoding/app
npm ci && npm run build
cd src-tauri && cargo build --release
mkdir -p ~/.fitcoding/bin
cp target/release/fitcoding ~/.fitcoding/bin/
```

After that, the slash command works the same as the Windows install path. The macOS binary is unsigned — if Gatekeeper blocks it, run `xattr -d com.apple.quarantine ~/.fitcoding/bin/fitcoding` once.

Linux requires WebKit2GTK 4.1 (`libwebkit2gtk-4.1-0` on Debian/Ubuntu).

## Privacy

The webcam stream stays on your machine. The MediaPipe pose model (`pose_landmarker_lite.task`, ~6 MB) and the WASM runtime are downloaded from Google's MediaPipe model storage and jsDelivr CDN respectively on first launch, then cached by the OS. No telemetry. No frames leave the device.

## License

MIT — see [`LICENSE`](./LICENSE).
