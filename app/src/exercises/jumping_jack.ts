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
