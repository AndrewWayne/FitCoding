import { invoke } from "@tauri-apps/api/core";

export async function getExercise(): Promise<string> {
  return invoke<string>("get_exercise");
}

export async function saveScore(exercise: string, reps: number): Promise<void> {
  await invoke("save_score", { exercise, reps });
}
