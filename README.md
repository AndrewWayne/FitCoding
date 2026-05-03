# FitCoding

Get up. Stand up. Stand up for your reps.

A Claude Code plugin: while Claude is thinking, type `/fit` to interrupt yourself with a 30-second exercise mini-game. Squat, jumping jack, or push-up — webcam pose detection counts your reps. After 30s the window auto-closes; `/fit board` prints your daily scoreboard.

## Install

```
/plugin install AndrewWayne/FitCoding
```

The first time you run `/fit`, a small native binary (~10–20 MB) is downloaded from this repo's GitHub Releases into `~/.fitcoding/bin/` and reused after that.

### macOS

Native arm64 (Apple Silicon) binary only — Intel Macs run the same arm64 binary under Rosetta 2 (Tauri 2 supports this). Native Intel build returns in v0.0.3. The bundled binary is unsigned; if Gatekeeper blocks it on first launch attempt:

```
xattr -d com.apple.quarantine ~/.fitcoding/bin/fitcoding
```

You'll also see a one-time camera-permission prompt — grant it; the model runs locally.

### Windows

SmartScreen may show a "Windows protected your PC" notice on the very first run. Click _More info → Run anyway_. The slash command runs the bootstrap script via Git Bash (bundled with Git for Windows); install Git Bash if you don't already have it.

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
