import { distance } from "./angles";
import type { ExerciseModule, RepState, RepPhase } from "./types";
import { LM } from "../pose/types";
import type { PoseLandmarks, Landmark } from "../pose/types";

const CLOSED_RATIO = 1.1;
const OPEN_RATIO = 1.3;
const VIS_MIN = 0.5;

const vis = (lm: Landmark | undefined): boolean =>
  !!lm && lm.visibility >= VIS_MIN;

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
      const shL = landmarks[LM.LEFT_SHOULDER];
      const shR = landmarks[LM.RIGHT_SHOULDER];
      const wrL = landmarks[LM.LEFT_WRIST];
      const wrR = landmarks[LM.RIGHT_WRIST];
      const hipL = landmarks[LM.LEFT_HIP];
      const hipR = landmarks[LM.RIGHT_HIP];
      const ankL = landmarks[LM.LEFT_ANKLE];
      const ankR = landmarks[LM.RIGHT_ANKLE];

      const wristsUsable = vis(shL) && vis(shR) && vis(wrL) && vis(wrR);
      const anklesUsable = vis(hipL) && vis(hipR) && vis(ankL) && vis(ankR);

      // Need at least the upper body — wrists relative to shoulders is the
      // primary signal (arms going up is more visually distinct than legs
      // spreading, and laptop cameras rarely capture ankles anyway).
      if (!wristsUsable) {
        return { reps, phase, progress: 0 };
      }

      const shoulderWidth = distance(shL!, shR!);
      const wristGap = distance(wrL!, wrR!);
      const wristRatio = shoulderWidth > 0 ? wristGap / shoulderWidth : 0;

      let ratio: number;
      let isClosed: boolean;
      let isOpen: boolean;

      if (anklesUsable) {
        // Full-body: require BOTH wrist AND ankle ratios to cross the threshold.
        // More robust against false positives where only one limb pair moves.
        const hipWidth = distance(hipL!, hipR!);
        const ankleGap = distance(ankL!, ankR!);
        const ankleRatio = hipWidth > 0 ? ankleGap / hipWidth : 0;
        ratio = (wristRatio + ankleRatio) / 2;
        isClosed = wristRatio < CLOSED_RATIO && ankleRatio < CLOSED_RATIO;
        isOpen = wristRatio > OPEN_RATIO && ankleRatio > OPEN_RATIO;
      } else {
        // Half-body: wrists only. False positives possible if a user waves
        // arms without jumping; acceptable v0.0.2 trade-off for better
        // laptop-camera coverage.
        ratio = wristRatio;
        isClosed = wristRatio < CLOSED_RATIO;
        isOpen = wristRatio > OPEN_RATIO;
      }

      const progress = clamp01((ratio - CLOSED_RATIO) / (OPEN_RATIO - CLOSED_RATIO));

      // We reuse the up/down phase names: "down" = closed, "up" = open.
      if (isClosed) {
        phase = "down";
      } else if (isOpen) {
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
