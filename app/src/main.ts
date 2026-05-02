import { invoke } from "@tauri-apps/api/core";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { initPose } from "./pose";
import { createWebcam } from "./ui/webcam";
import { createPixelMan } from "./ui/pixelman";
import { createOverlay } from "./ui/overlay";
import { runIntroCountdown, runSessionTimer, formatRemaining } from "./ui/timer";
import { createExercise, isExerciseName } from "./exercises";
import { getExercise, saveScore } from "./ipc";

// Pipe webview console output into the Tauri stdout stream so we can read it
// from outside the app. The Rust `log` command does eprintln!.
function fmt(args: unknown[]): string {
  return args
    .map((a) => {
      if (a instanceof Error) return `${a.name}: ${a.message}`;
      if (typeof a === "object") {
        try { return JSON.stringify(a); } catch { return String(a); }
      }
      return String(a);
    })
    .join(" ");
}
const _origLog = console.log.bind(console);
const _origWarn = console.warn.bind(console);
const _origError = console.error.bind(console);
console.log = (...args: unknown[]) => { _origLog(...args); invoke("log", { message: "LOG  " + fmt(args) }).catch(() => {}); };
console.warn = (...args: unknown[]) => { _origWarn(...args); invoke("log", { message: "WARN " + fmt(args) }).catch(() => {}); };
console.error = (...args: unknown[]) => { _origError(...args); invoke("log", { message: "ERR  " + fmt(args) }).catch(() => {}); };
window.addEventListener("error", (e) => {
  invoke("log", { message: `UNCAUGHT ${e.message} at ${e.filename}:${e.lineno}:${e.colno}` }).catch(() => {});
});
window.addEventListener("unhandledrejection", (e) => {
  invoke("log", { message: `UNHANDLED ${fmt([e.reason])}` }).catch(() => {});
});

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
    await webcam.start((msg) => overlay.showText(msg));
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    overlay.showText(`Camera failed: ${msg.slice(0, 200)}`);
    console.error("[fitcoding] webcam.start() rejected:", e);
    return;
  }

  overlay.showText("Loading model…");
  const pose = await initPose();
  console.log("[fitcoding] initPose() resolved");
  overlay.hide();

  await runIntroCountdown((label) => overlay.showText(label)).promise;
  console.log("[fitcoding] countdown done, entering session loop");
  overlay.hide();

  let lastReps = 0;
  let frameTimestamp = 0;
  let frameCount = 0;
  let nullCount = 0;
  let firstLandmarksLogged = false;

  const session = runSessionTimer(SESSION_DURATION_MS, (remaining) => {
    timeLeftEl.textContent = formatRemaining(remaining);
    frameTimestamp += 33; // approximate; pose only needs monotonically increasing values
    frameCount += 1;
    const landmarks = pose.detect(camEl, frameTimestamp);
    if (!landmarks) {
      nullCount += 1;
      if (frameCount === 1 || frameCount === 30 || frameCount === 60 || frameCount === 300) {
        console.log("[fitcoding] frame", frameCount, "no landmarks; videoReady=", camEl.readyState, "videoSize=", camEl.videoWidth + "x" + camEl.videoHeight);
      }
      webcam.drawSkeleton(null);
      cueEl.textContent = "Step into frame";
      return;
    }
    if (!firstLandmarksLogged) {
      console.log("[fitcoding] first landmarks at frame", frameCount, "after", nullCount, "null frames");
      firstLandmarksLogged = true;
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
  console.log("[fitcoding] session done; frames=", frameCount, "nullFrames=", nullCount, "lastReps=", lastReps);

  pose.close();
  webcam.stop();

  try {
    await saveScore(exerciseName, lastReps);
    console.log("[fitcoding] saveScore ok");
  } catch (e) {
    console.error("[fitcoding] save_score failed:", e);
  }

  overlay.showScore(exerciseName, lastReps);
  setTimeout(() => {
    console.log("[fitcoding] closing window via tauri api");
    getCurrentWebviewWindow().close().catch((e) => console.error("[fitcoding] close failed:", e));
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
