import { describe, it, expect } from "vitest";
import { angleAtVertex, distance } from "./angles";

describe("angleAtVertex", () => {
  it("returns 90 for a perfect right angle", () => {
    const a = { x: 1, y: 0 };
    const v = { x: 0, y: 0 };
    const b = { x: 0, y: 1 };
    expect(angleAtVertex(a, v, b)).toBeCloseTo(90, 5);
  });

  it("returns 180 for collinear points on opposite sides", () => {
    expect(angleAtVertex({ x: -1, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 0 }))
      .toBeCloseTo(180, 5);
  });

  it("returns 0 for collinear points on the same side", () => {
    expect(angleAtVertex({ x: 1, y: 0 }, { x: 0, y: 0 }, { x: 2, y: 0 }))
      .toBeCloseTo(0, 5);
  });

  it("returns 60 for a known 60-degree triangle", () => {
    const a = { x: 1, y: 0 };
    const v = { x: 0, y: 0 };
    const b = { x: Math.cos(Math.PI / 3), y: Math.sin(Math.PI / 3) };
    expect(angleAtVertex(a, v, b)).toBeCloseTo(60, 4);
  });
});

describe("distance", () => {
  it("returns 5 for a 3-4-5 triangle", () => {
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBeCloseTo(5, 5);
  });

  it("returns 0 for identical points", () => {
    expect(distance({ x: 1, y: 1 }, { x: 1, y: 1 })).toBe(0);
  });
});
