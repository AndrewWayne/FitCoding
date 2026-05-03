# FitCoding

Get up. Stand up. Stand up for your reps.

A Claude Code plugin: while Claude is thinking, type `/fit` to interrupt yourself with a 30-second exercise mini-game. Squat, jumping jack, or push-up — webcam pose detection counts your reps. After 30s the window auto-closes; `/fit board` prints your daily scoreboard.

## Install

```
/plugin install AndrewWayne/FitCoding
```

The first time you run `/fit`, a small native binary (~10–20 MB) is downloaded from this repo's GitHub Releases into `~/.fitcoding/bin/` and reused after that.

### Platform support (v0.0.2)

**Windows x64** is the only fully-supported platform in v0.0.2. Linux + macOS arm64 builds are pending CI debugging — both can build the binary locally from source:

```
git clone https://github.com/AndrewWayne/FitCoding && cd FitCoding/app
npm ci && npm run build
cd src-tauri && cargo build --release
mkdir -p ~/.fitcoding/bin
cp target/release/fitcoding ~/.fitcoding/bin/
```

After that, the slash command (or running `~/.fitcoding/bin/fitcoding launch` directly) works the same as the Windows install path.

### Windows

SmartScreen may show a "Windows protected your PC" notice on the very first run. Click _More info → Run anyway_. The slash command runs the bootstrap script via Git Bash (bundled with Git for Windows); install Git Bash if you don't already have it.

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
