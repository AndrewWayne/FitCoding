import { describe, it, expect } from "vitest";
import { progressToFrame } from "./pixelman";

describe("progressToFrame", () => {
  it("returns 0 at progress 0", () => {
    expect(progressToFrame(0, 4)).toBe(0);
  });
  it("returns frameCount-1 at progress 1", () => {
    expect(progressToFrame(1, 4)).toBe(3);
  });
  it("returns 2 at progress 0.5 with 4 frames", () => {
    expect(progressToFrame(0.5, 4)).toBe(2);
  });
  it("clamps progress > 1 to last frame", () => {
    expect(progressToFrame(1.7, 4)).toBe(3);
  });
  it("clamps negative progress to first frame", () => {
    expect(progressToFrame(-0.4, 4)).toBe(0);
  });
});
