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
