import { angleAtVertex } from "./angles";
import type { ExerciseModule, RepState, RepPhase } from "./types";
import { LM } from "../pose/types";
import type { PoseLandmarks, Landmark } from "../pose/types";

const DOWN_THRESHOLD = 110;
const UP_THRESHOLD = 150;
const VIS_MIN = 0.5;

const vis = (lm: Landmark | undefined): boolean =>
  !!lm && lm.visibility >= VIS_MIN;

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
      const shL = landmarks[LM.LEFT_SHOULDER];
      const elL = landmarks[LM.LEFT_ELBOW];
      const wrL = landmarks[LM.LEFT_WRIST];
      const shR = landmarks[LM.RIGHT_SHOULDER];
      const elR = landmarks[LM.RIGHT_ELBOW];
      const wrR = landmarks[LM.RIGHT_WRIST];

      const usableL = vis(shL) && vis(elL) && vis(wrL);
      const usableR = vis(shR) && vis(elR) && vis(wrR);

      let angle: number | null = null;
      if (usableL && usableR) {
        angle = (angleAtVertex(shL!, elL!, wrL!) + angleAtVertex(shR!, elR!, wrR!)) / 2;
      } else if (usableL) {
        angle = angleAtVertex(shL!, elL!, wrL!);
      } else if (usableR) {
        angle = angleAtVertex(shR!, elR!, wrR!);
      }

      // No usable arm — push-ups inherently need a side-on or low camera angle
      // that captures the arms; if both sides are occluded we can't detect.
      if (angle === null) {
        return { reps, phase, progress: 0 };
      }

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
