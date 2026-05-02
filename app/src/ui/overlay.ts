export interface Overlay {
  showText(text: string): void;
  showScore(exercise: string, reps: number): void;
  hide(): void;
}

const PRETTY_NAMES: Record<string, string> = {
  squat: "squats",
  jumping_jack: "jumping jacks",
  pushup: "push-ups",
};

export function createOverlay(el: HTMLElement): Overlay {
  return {
    showText(text: string) {
      el.textContent = text;
      el.classList.remove("hidden");
    },
    showScore(exercise: string, reps: number) {
      const label = PRETTY_NAMES[exercise] ?? exercise;
      el.textContent = `Congrats! ${reps} ${label} in 30s`;
      el.classList.remove("hidden");
    },
    hide() {
      el.textContent = "";
      el.classList.add("hidden");
    },
  };
}
