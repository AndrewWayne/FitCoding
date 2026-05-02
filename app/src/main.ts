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
