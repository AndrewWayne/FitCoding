import { describe, it, expect, beforeEach } from "vitest";
import { createPushup } from "./pushup";
import { LM } from "../pose/types";
import type { Landmark } from "../pose/types";

function landmarksWithElbowAngle(angleDeg: number): Landmark[] {
  // Shoulder at (0,0), elbow at (0,1). Wrist rotated to form the requested angle at the elbow.
  const arr: Landmark[] = Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0, visibility: 1 }));
  const shoulder = { x: 0, y: 0 };
  const elbow = { x: 0, y: 1 };
  const theta = ((180 - angleDeg) * Math.PI) / 180;
  const wrist = {
    x: elbow.x + Math.sin(theta),
    y: elbow.y + Math.cos(theta),
  };
  arr[LM.RIGHT_SHOULDER] = { ...shoulder, z: 0, visibility: 1 };
  arr[LM.RIGHT_ELBOW] = { ...elbow, z: 0, visibility: 1 };
  arr[LM.RIGHT_WRIST] = { ...wrist, z: 0, visibility: 1 };
  arr[LM.LEFT_SHOULDER] = { ...shoulder, z: 0, visibility: 1 };
  arr[LM.LEFT_ELBOW] = { ...elbow, z: 0, visibility: 1 };
  arr[LM.LEFT_WRIST] = { ...wrist, z: 0, visibility: 1 };
  return arr;
}

describe("createPushup", () => {
  let mod: ReturnType<typeof createPushup>;
  beforeEach(() => { mod = createPushup(); });

  it("counts a full down→up cycle", () => {
    mod.update(landmarksWithElbowAngle(170)); // up
    expect(mod.update(landmarksWithElbowAngle(100)).phase).toBe("down");
    const r = mod.update(landmarksWithElbowAngle(160));
    expect(r.phase).toBe("up");
    expect(r.reps).toBe(1);
  });

  it("does not count partial reps above the down threshold", () => {
    mod.update(landmarksWithElbowAngle(170));
    mod.update(landmarksWithElbowAngle(120)); // didn't reach 110
    expect(mod.update(landmarksWithElbowAngle(170)).reps).toBe(0);
  });

  it("counts five reps", () => {
    mod.update(landmarksWithElbowAngle(170));
    for (let i = 0; i < 5; i++) {
      mod.update(landmarksWithElbowAngle(100));
      mod.update(landmarksWithElbowAngle(160));
    }
    expect(mod.update(landmarksWithElbowAngle(160)).reps).toBe(5);
  });

  it("reset clears reps", () => {
    mod.update(landmarksWithElbowAngle(170));
    mod.update(landmarksWithElbowAngle(100));
    mod.update(landmarksWithElbowAngle(160));
    mod.reset();
    expect(mod.update(landmarksWithElbowAngle(160)).reps).toBe(0);
  });
});
