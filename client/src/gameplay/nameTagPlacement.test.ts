import { describe, expect, it } from "vitest";
import { WALL_HEIGHT } from "../world/builder";
import { NameTagPlacement } from "./nameTagPlacement";

const PLANE_H = 0.7875;
const CLEARANCE = 0.28;
const ORIGIN_Y = 0.85;

describe("NameTagPlacement", () => {
  it("keeps a tag where it was asked to be when there is room", () => {
    expect(NameTagPlacement.centerY(2.0, 0.8)).toBe(2.0);
  });

  it("never lets the top of a tag go through the ceiling", () => {
    const planeHeight = 0.8;
    const y = NameTagPlacement.centerY(3.4, planeHeight);
    expect(y + planeHeight / 2).toBeLessThan(WALL_HEIGHT);
  });

  describe("place", () => {
    const bottom = (p: { centerY: number; scale: number }): number => p.centerY - (PLANE_H * p.scale) / 2;
    const top = (p: { centerY: number; scale: number }): number => p.centerY + (PLANE_H * p.scale) / 2;

    it("sits the full clearance above a short hat at full size", () => {
      const placed = NameTagPlacement.place(ORIGIN_Y + 0.9, PLANE_H, CLEARANCE);
      expect(placed.scale).toBe(1);
      expect(bottom(placed)).toBeCloseTo(ORIGIN_Y + 0.9 + CLEARANCE, 5);
    });

    it("moves up with every hat height while there is room", () => {
      const low = NameTagPlacement.place(ORIGIN_Y + 0.9, PLANE_H, CLEARANCE);
      const high = NameTagPlacement.place(ORIGIN_Y + 1.0, PLANE_H, CLEARANCE);
      expect(high.centerY).toBeGreaterThan(low.centerY);
    });

    it("gives up clearance before size when the ceiling is close", () => {
      const placed = NameTagPlacement.place(ORIGIN_Y + 1.2, PLANE_H, CLEARANCE);
      expect(placed.scale).toBe(1);
      expect(top(placed)).toBeCloseTo(WALL_HEIGHT - NameTagPlacement.CEILING_GAP, 5);
      expect(bottom(placed)).toBeGreaterThanOrEqual(ORIGIN_Y + 1.2 + NameTagPlacement.MIN_CLEARANCE - 1e-9);
    });

    it("keeps the wizard tag at least 85 percent size and pushes it in front of the tip", () => {
      const tip = ORIGIN_Y + 1.595;
      const placed = NameTagPlacement.place(tip, PLANE_H, CLEARANCE);
      expect(placed.scale).toBeGreaterThanOrEqual(NameTagPlacement.MIN_SCALE);
      expect(placed.forward).toBe(NameTagPlacement.FORWARD);
      expect(top(placed)).toBeLessThanOrEqual(WALL_HEIGHT - NameTagPlacement.CEILING_GAP + 1e-9);
    });

    it("never pushes a tag forward when it clears the hat", () => {
      expect(NameTagPlacement.place(ORIGIN_Y + 0.9, PLANE_H, CLEARANCE).forward).toBe(0);
      expect(NameTagPlacement.place(ORIGIN_Y + 1.2, PLANE_H, CLEARANCE).forward).toBe(0);
    });

    it("lets the ceiling win over the hat when even the smallest tag cannot fit", () => {
      const placed = NameTagPlacement.place(WALL_HEIGHT - 0.1, PLANE_H, CLEARANCE);
      expect(placed.scale).toBe(NameTagPlacement.MIN_SCALE);
      expect(placed.forward).toBe(NameTagPlacement.FORWARD);
      expect(top(placed)).toBeCloseTo(WALL_HEIGHT - NameTagPlacement.CEILING_GAP, 5);
    });
  });
});
