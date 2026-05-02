import type { PoseLandmarks } from "../pose/types";

export type RepPhase = "ready" | "down" | "up";

export interface RepState {
  reps: number;
  phase: RepPhase;
  /** 0..1: how far through the rep cycle the body currently is. */
  progress: number;
}

export interface ExerciseModule {
  /** Stable internal name, e.g. "squat". */
  name: string;
  /** Short string shown in the pixel-man panel under the sprite. */
  formCue: string;
  /** Reset counters for a fresh 30s session. */
  reset(): void;
  /** Consume the latest pose and return current rep state. */
  update(landmarks: PoseLandmarks): RepState;
}
