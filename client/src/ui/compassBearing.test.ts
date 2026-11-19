import { describe, expect, it } from "vitest";
import { CompassBearing } from "./compassBearing";

function ahead(yaw: number, distance: number): { dx: number; dz: number } {
  return { dx: -Math.sin(yaw) * distance, dz: -Math.cos(yaw) * distance };
}

function rightOf(yaw: number, distance: number): { dx: number; dz: number } {
  return { dx: Math.cos(yaw) * distance, dz: -Math.sin(yaw) * distance };
}

describe("CompassBearing", () => {
  it.each([0, 0.7, 1.976, Math.PI / 2, Math.PI, -2.3])(
    "points straight up at a target dead ahead for yaw %f",
    (yaw) => {
      const { dx, dz } = ahead(yaw, 11);
      expect(CompassBearing.angle(dx, dz, yaw)).toBeCloseTo(0, 6);
    },
  );

  it.each([0, 0.7, 1.976, Math.PI / 2, -2.3])(
    "points right at a target on the right for yaw %f",
    (yaw) => {
      const { dx, dz } = rightOf(yaw, 7);
      expect(CompassBearing.angle(dx, dz, yaw)).toBeCloseTo(Math.PI / 2, 6);
    },
  );

  it("points down at a target directly behind", () => {
    const { dx, dz } = ahead(1.2, -5);
    expect(Math.abs(CompassBearing.angle(dx, dz, 1.2))).toBeCloseTo(Math.PI, 6);
  });
});
