import { createSquat } from "./squat";
import { createJumpingJack } from "./jumping_jack";
import { createPushup } from "./pushup";
import type { ExerciseModule } from "./types";

export type ExerciseName = "squat" | "jumping_jack" | "pushup";

export function createExercise(name: ExerciseName): ExerciseModule {
  switch (name) {
    case "squat": return createSquat();
    case "jumping_jack": return createJumpingJack();
    case "pushup": return createPushup();
  }
}

export function isExerciseName(s: string): s is ExerciseName {
  return s === "squat" || s === "jumping_jack" || s === "pushup";
}

export type { ExerciseModule } from "./types";
