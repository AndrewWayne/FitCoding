import { describe, it, expect } from "vitest";
import { formatRemaining } from "./timer";

describe("formatRemaining", () => {
  it("formats whole seconds", () => {
    expect(formatRemaining(30_000)).toBe("00:30");
    expect(formatRemaining(7_000)).toBe("00:07");
  });
  it("rounds up partial seconds so 0 doesn't appear early", () => {
    expect(formatRemaining(30_500)).toBe("00:31");
    expect(formatRemaining(1)).toBe("00:01");
  });
  it("formats zero as 00:00 even on small negative inputs", () => {
    expect(formatRemaining(0)).toBe("00:00");
    expect(formatRemaining(-50)).toBe("00:00");
  });
});
