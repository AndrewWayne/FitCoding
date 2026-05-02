export function formatRemaining(ms: number): string {
  const safe = Math.max(0, ms);
  const seconds = Math.ceil(safe / 1000);
  const mm = Math.floor(seconds / 60).toString().padStart(2, "0");
  const ss = (seconds % 60).toString().padStart(2, "0");
  return `${mm}:${ss}`;
}

export interface CountdownHandle {
  cancel(): void;
  promise: Promise<void>;
}

/** Run a 3-2-1-GO countdown, calling onTick with each label. Resolves after GO. */
export function runIntroCountdown(onTick: (label: string) => void): CountdownHandle {
  const labels = ["3", "2", "1", "GO!"];
  let cancelled = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const promise = new Promise<void>((resolve) => {
    let i = 0;
    const tick = () => {
      if (cancelled) return resolve();
      if (i >= labels.length) return resolve();
      onTick(labels[i]!);
      i += 1;
      timer = setTimeout(tick, 700);
    };
    tick();
  });

  return {
    cancel() {
      cancelled = true;
      if (timer) clearTimeout(timer);
    },
    promise,
  };
}

export interface SessionTimerHandle {
  cancel(): void;
  promise: Promise<void>;
}

/**
 * Run a session timer for `durationMs` ms.
 * Calls onTick about 10x/second with the remaining ms.
 */
export function runSessionTimer(
  durationMs: number,
  onTick: (remainingMs: number) => void,
): SessionTimerHandle {
  let cancelled = false;
  const start = performance.now();
  let raf = 0;
  const promise = new Promise<void>((resolve) => {
    const loop = () => {
      if (cancelled) return resolve();
      const elapsed = performance.now() - start;
      const remaining = Math.max(0, durationMs - elapsed);
      onTick(remaining);
      if (remaining <= 0) return resolve();
      raf = requestAnimationFrame(loop);
    };
    loop();
  });
  return {
    cancel() {
      cancelled = true;
      cancelAnimationFrame(raf);
    },
    promise,
  };
}
