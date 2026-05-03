import { angleAtVertex } from "./angles";
import type { ExerciseModule, RepState, RepPhase } from "./types";
import { LM } from "../pose/types";
import type { PoseLandmarks, Landmark } from "../pose/types";

// Full-body angle thresholds (when both legs visible).
const DOWN_THRESHOLD = 120;
const UP_THRESHOLD = 150;

// Half-body fallback (laptop cameras typically frame chest-up; legs often
// missing). When no leg landmarks are usable we track shoulder-midpoint Y
// drop relative to a baseline calibrated in the first ~1 second.
const VIS_MIN = 0.5;
const BASELINE_FRAMES_TARGET = 30;
const SHOULDER_DROP_DOWN = 0.06; // normalized image-Y units (image is [0..1])
const SHOULDER_DROP_UP = 0.02;

const vis = (lm: Landmark | undefined): boolean =>
  !!lm && lm.visibility >= VIS_MIN;

export function createSquat(): ExerciseModule {
  let reps = 0;
  let phase: RepPhase = "ready";
  let baselineY: number | null = null;
  let baselineSum = 0;
  let baselineCount = 0;

  return {
    name: "squat",
    formCue: "Bend the knees, keep your back straight",
    reset() {
      reps = 0;
      phase = "ready";
      baselineY = null;
      baselineSum = 0;
      baselineCount = 0;
    },
    update(landmarks: PoseLandmarks): RepState {
      const hipL = landmarks[LM.LEFT_HIP];
      const kneeL = landmarks[LM.LEFT_KNEE];
      const ankleL = landmarks[LM.LEFT_ANKLE];
      const hipR = landmarks[LM.RIGHT_HIP];
      const kneeR = landmarks[LM.RIGHT_KNEE];
      const ankleR = landmarks[LM.RIGHT_ANKLE];

      const usableL = vis(hipL) && vis(kneeL) && vis(ankleL);
      const usableR = vis(hipR) && vis(kneeR) && vis(ankleR);

      let angle: number | null = null;
      if (usableL && usableR) {
        angle = (angleAtVertex(hipL!, kneeL!, ankleL!) + angleAtVertex(hipR!, kneeR!, ankleR!)) / 2;
      } else if (usableL) {
        angle = angleAtVertex(hipL!, kneeL!, ankleL!);
      } else if (usableR) {
        angle = angleAtVertex(hipR!, kneeR!, ankleR!);
      }

      if (angle !== null) {
        const progress = clamp01((UP_THRESHOLD - angle) / (UP_THRESHOLD - DOWN_THRESHOLD));
        if (angle < DOWN_THRESHOLD) {
          phase = "down";
        } else if (angle > UP_THRESHOLD) {
          if (phase === "down") reps += 1;
          phase = "up";
        }
        return { reps, phase, progress };
      }

      // Half-body fallback: track shoulder-midpoint Y drop.
      const shoulderL = landmarks[LM.LEFT_SHOULDER];
      const shoulderR = landmarks[LM.RIGHT_SHOULDER];
      if (!vis(shoulderL) || !vis(shoulderR)) {
        return { reps, phase, progress: 0 };
      }
      const shoulderY = (shoulderL!.y + shoulderR!.y) / 2;

      if (baselineY === null) {
        baselineSum += shoulderY;
        baselineCount += 1;
        if (baselineCount >= BASELINE_FRAMES_TARGET) {
          baselineY = baselineSum / baselineCount;
        }
        return { reps, phase, progress: 0 };
      }

      const drop = shoulderY - baselineY; // positive = lower in frame = squatting down
      const progress = clamp01(drop / SHOULDER_DROP_DOWN);
      if (drop > SHOULDER_DROP_DOWN) {
        phase = "down";
      } else if (drop < SHOULDER_DROP_UP) {
        if (phase === "down") reps += 1;
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
