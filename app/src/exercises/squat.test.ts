import { describe, it, expect, beforeEach } from "vitest";
import { createSquat } from "./squat";
import { LM } from "../pose/types";
import type { Landmark } from "../pose/types";

function landmarksWithKneeAngle(angleDeg: number): Landmark[] {
  // Build a synthetic body where the right leg has the requested hip-knee-ankle angle.
  // Hip at (0, 0), knee at (0, 1) (straight down). Ankle is angleDeg below the leg axis.
  const arr: Landmark[] = Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0, visibility: 1 }));
  const hip = { x: 0, y: 0 };
  const knee = { x: 0, y: 1 };
  // Ankle direction: rotate downward (0,1) by (180 - angle) around the knee.
  // For angle=180, ankle is straight further down (0,2). For angle=90, ankle is to the side (1,1).
  const theta = ((180 - angleDeg) * Math.PI) / 180;
  const ankle = {
    x: knee.x + Math.sin(theta),
    y: knee.y + Math.cos(theta),
  };
  arr[LM.RIGHT_HIP] = { ...hip, z: 0, visibility: 1 };
  arr[LM.RIGHT_KNEE] = { ...knee, z: 0, visibility: 1 };
  arr[LM.RIGHT_ANKLE] = { ...ankle, z: 0, visibility: 1 };
  // Mirror to left side so module averaging works.
  arr[LM.LEFT_HIP] = { ...hip, z: 0, visibility: 1 };
  arr[LM.LEFT_KNEE] = { ...knee, z: 0, visibility: 1 };
  arr[LM.LEFT_ANKLE] = { ...ankle, z: 0, visibility: 1 };
  return arr;
}

describe("createSquat", () => {
  let mod: ReturnType<typeof createSquat>;
  beforeEach(() => { mod = createSquat(); });

  it("starts in 'ready' with zero reps", () => {
    const initial = mod.update(landmarksWithKneeAngle(170));
    expect(initial.reps).toBe(0);
    expect(initial.phase).toBe("up");
  });

  it("counts a rep on a full down→up cycle", () => {
    mod.update(landmarksWithKneeAngle(170)); // up
    let r = mod.update(landmarksWithKneeAngle(110)); // down (≤120)
    expect(r.phase).toBe("down");
    expect(r.reps).toBe(0);
    r = mod.update(landmarksWithKneeAngle(160)); // up (>150)
    expect(r.phase).toBe("up");
    expect(r.reps).toBe(1);
  });

  it("does not count partial squats above the down threshold", () => {
    mod.update(landmarksWithKneeAngle(170));
    mod.update(landmarksWithKneeAngle(135)); // didn't reach 120
    const r = mod.update(landmarksWithKneeAngle(170));
    expect(r.reps).toBe(0);
  });

  it("counts multiple reps", () => {
    mod.update(landmarksWithKneeAngle(170));
    for (let i = 0; i < 3; i++) {
      mod.update(landmarksWithKneeAngle(110));
      mod.update(landmarksWithKneeAngle(160));
    }
    const r = mod.update(landmarksWithKneeAngle(160));
    expect(r.reps).toBe(3);
  });

  it("progress is 0 at fully extended and 1 at deep squat", () => {
    const upProgress = mod.update(landmarksWithKneeAngle(160)).progress;
    const downProgress = mod.update(landmarksWithKneeAngle(110)).progress;
    expect(upProgress).toBeCloseTo(0, 1);
    expect(downProgress).toBeCloseTo(1, 1);
  });

  it("reset clears reps and phase", () => {
    mod.update(landmarksWithKneeAngle(170));
    mod.update(landmarksWithKneeAngle(110));
    mod.update(landmarksWithKneeAngle(160));
    expect(mod.update(landmarksWithKneeAngle(160)).reps).toBe(1);
    mod.reset();
    expect(mod.update(landmarksWithKneeAngle(160)).reps).toBe(0);
  });
});
