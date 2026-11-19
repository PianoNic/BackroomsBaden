import { describe, expect, it } from "vitest";
import { WALL_HEIGHT } from "../world/builder";
import { NameTagPlacement, type TagPlacement } from "./nameTagPlacement";
import playerSource from "./player.ts?raw";

const PLANE_H = 0.7875;
const CLEARANCE = 0.28;
const ORIGIN_Y = 0.85;
const WIZARD_TIP = ORIGIN_Y + 1.595;
const CEILING = WALL_HEIGHT - NameTagPlacement.CEILING_GAP;

const wizardRadius = (y: number): number => Math.max(0, (0.24 * (WIZARD_TIP - y)) / 0.65);
const bottom = (p: TagPlacement): number => p.centerY - (PLANE_H * p.scale) / 2;
const top = (p: TagPlacement): number => p.centerY + (PLANE_H * p.scale) / 2;

describe("NameTagPlacement", () => {
  it("keeps a tag where it was asked to be when there is room", () => {
    expect(NameTagPlacement.centerY(2.0, 0.8)).toBe(2.0);
  });

  it("never lets the top of a tag go through the ceiling", () => {
    const planeHeight = 0.8;
    const y = NameTagPlacement.centerY(3.4, planeHeight);
    expect(y + planeHeight / 2).toBeLessThan(WALL_HEIGHT);
  });

  it("caps the push well inside the player collision radius", () => {
    expect(NameTagPlacement.MAX_PUSH).toBeLessThanOrEqual(0.25);
    expect(NameTagPlacement.MAX_PUSH).toBeLessThan(NameTagPlacement.PLAYER_RADIUS);
  });

  it("uses the same radius as the player collision", () => {
    expect(playerSource).toContain(`const RADIUS = ${NameTagPlacement.PLAYER_RADIUS};`);
  });

  describe("place", () => {
    it("sits the full clearance above a short hat at full size", () => {
      const placed = NameTagPlacement.place(ORIGIN_Y + 0.9, PLANE_H, CLEARANCE);
      expect(placed.scale).toBe(1);
      expect(placed.forward).toBe(0);
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
      expect(placed.forward).toBe(0);
      expect(top(placed)).toBeCloseTo(CEILING, 5);
      expect(bottom(placed)).toBeGreaterThanOrEqual(ORIGIN_Y + 1.2 + NameTagPlacement.MIN_CLEARANCE - 1e-9);
    });

    it("pushes the wizard tag forward by the cone radius at its bottom edge plus a margin", () => {
      const placed = NameTagPlacement.place(WIZARD_TIP, PLANE_H, CLEARANCE, wizardRadius);
      expect(placed.scale).toBe(1);
      expect(top(placed)).toBeCloseTo(CEILING, 5);
      expect(placed.forward).toBeCloseTo(wizardRadius(bottom(placed)) + NameTagPlacement.PUSH_MARGIN, 5);
      expect(placed.forward).toBeLessThanOrEqual(NameTagPlacement.MAX_PUSH);
      expect(placed.forward).toBeLessThan(NameTagPlacement.PLAYER_RADIUS);
    });

    it("shrinks a little instead of pushing when that clears a hat that is only just in the way", () => {
      const tophatTop = ORIGIN_Y + 1.33;
      const placed = NameTagPlacement.place(tophatTop, PLANE_H, CLEARANCE, () => 0.22);
      expect(placed.forward).toBe(0);
      expect(placed.scale).toBeGreaterThanOrEqual(NameTagPlacement.MIN_SCALE);
      expect(placed.scale).toBeLessThan(1);
      expect(bottom(placed)).toBeGreaterThanOrEqual(tophatTop);
    });

    it("shrinks, but never below the minimum, when the hat is too wide at full size", () => {
      const wide = (y: number): number => (y < CEILING - PLANE_H * 0.9 ? 0.3 : 0.1);
      const placed = NameTagPlacement.place(WIZARD_TIP, PLANE_H, CLEARANCE, wide);
      expect(placed.scale).toBeLessThan(1);
      expect(placed.scale).toBeGreaterThanOrEqual(NameTagPlacement.MIN_SCALE);
      expect(placed.forward).toBeLessThanOrEqual(NameTagPlacement.MAX_PUSH);
    });

    it("falls back to the smallest allowed tag and the capped push when nothing else works", () => {
      const placed = NameTagPlacement.place(WALL_HEIGHT - 0.1, PLANE_H, CLEARANCE, () => 1);
      expect(placed.scale).toBe(NameTagPlacement.MIN_SCALE);
      expect(placed.forward).toBe(NameTagPlacement.MAX_PUSH);
      expect(top(placed)).toBeCloseTo(CEILING, 5);
    });

    it("needs no push when the tag bottom is already above the hat", () => {
      const placed = NameTagPlacement.place(CEILING - PLANE_H + 0.03, PLANE_H, CLEARANCE, () => 1);
      expect(placed.forward).toBe(0);
    });
  });
});
