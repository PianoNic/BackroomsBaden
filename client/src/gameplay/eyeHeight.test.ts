import { describe, expect, it } from "vitest";
import { EyeHeight } from "./eyeHeight";

describe("EyeHeight", () => {
  it("starts at standing height", () => {
    expect(new EyeHeight().value).toBe(EyeHeight.STANDING);
  });

  it("lowers towards crouch height while crouching", () => {
    const eye = new EyeHeight();
    for (let i = 0; i < 60; i++) eye.step(true, 1 / 60);
    expect(eye.value).toBeCloseTo(EyeHeight.CROUCHING, 2);
  });

  it("moves gradually, not in one frame", () => {
    const eye = new EyeHeight();
    eye.step(true, 1 / 60);
    expect(eye.value).toBeLessThan(EyeHeight.STANDING);
    expect(eye.value).toBeGreaterThan(EyeHeight.CROUCHING + 0.3);
  });

  it("rises back to standing height and resets on respawn", () => {
    const eye = new EyeHeight();
    for (let i = 0; i < 60; i++) eye.step(true, 1 / 60);
    for (let i = 0; i < 60; i++) eye.step(false, 1 / 60);
    expect(eye.value).toBeCloseTo(EyeHeight.STANDING, 2);
    eye.step(true, 1);
    eye.reset();
    expect(eye.value).toBe(EyeHeight.STANDING);
  });
});
