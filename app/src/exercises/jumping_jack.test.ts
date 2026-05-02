import { describe, it, expect, beforeEach } from "vitest";
import { createJumpingJack } from "./jumping_jack";
import { LM } from "../pose/types";
import type { Landmark } from "../pose/types";

interface Geom {
  shoulderWidth: number;
  hipWidth: number;
  wristGap: number;
  ankleGap: number;
}

function landmarksWithGeom(g: Geom): Landmark[] {
  const arr: Landmark[] = Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0, visibility: 1 }));
  const sw = g.shoulderWidth / 2;
  const hw = g.hipWidth / 2;
  const wg = g.wristGap / 2;
  const ag = g.ankleGap / 2;
  arr[LM.LEFT_SHOULDER] = { x: -sw, y: 0, z: 0, visibility: 1 };
  arr[LM.RIGHT_SHOULDER] = { x: sw, y: 0, z: 0, visibility: 1 };
  arr[LM.LEFT_HIP] = { x: -hw, y: 1, z: 0, visibility: 1 };
  arr[LM.RIGHT_HIP] = { x: hw, y: 1, z: 0, visibility: 1 };
  arr[LM.LEFT_WRIST] = { x: -wg, y: -0.5, z: 0, visibility: 1 };
  arr[LM.RIGHT_WRIST] = { x: wg, y: -0.5, z: 0, visibility: 1 };
  arr[LM.LEFT_ANKLE] = { x: -ag, y: 2, z: 0, visibility: 1 };
  arr[LM.RIGHT_ANKLE] = { x: ag, y: 2, z: 0, visibility: 1 };
  return arr;
}

const closed = (): Landmark[] => landmarksWithGeom({
  shoulderWidth: 0.2, hipWidth: 0.2, wristGap: 0.18, ankleGap: 0.18,
});

const opened = (): Landmark[] => landmarksWithGeom({
  shoulderWidth: 0.2, hipWidth: 0.2, wristGap: 0.30, ankleGap: 0.30,
});

const halfway = (): Landmark[] => landmarksWithGeom({
  shoulderWidth: 0.2, hipWidth: 0.2, wristGap: 0.24, ankleGap: 0.24,
});

describe("createJumpingJack", () => {
  let mod: ReturnType<typeof createJumpingJack>;
  beforeEach(() => { mod = createJumpingJack(); });

  it("counts a full closed→open cycle", () => {
    mod.update(closed()); // closed phase set
    const r = mod.update(opened());
    expect(r.phase).toBe("up");
    expect(r.reps).toBe(1);
  });

  it("does not count partial movement", () => {
    mod.update(closed());
    mod.update(halfway());
    expect(mod.update(closed()).reps).toBe(0);
  });

  it("counts three reps", () => {
    mod.update(closed());
    for (let i = 0; i < 2; i++) {
      mod.update(opened());
      mod.update(closed());
    }
    expect(mod.update(opened()).reps).toBe(3);
  });

  it("progress reflects ratio between closed and open thresholds", () => {
    expect(mod.update(closed()).progress).toBeLessThanOrEqual(0);
    expect(mod.update(opened()).progress).toBeGreaterThanOrEqual(1);
  });

  it("reset clears reps", () => {
    mod.update(closed());
    mod.update(opened());
    mod.reset();
    expect(mod.update(opened()).reps).toBe(0);
  });
});
