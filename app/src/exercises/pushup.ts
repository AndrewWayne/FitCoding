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
