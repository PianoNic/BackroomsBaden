import { describe, expect, it } from "vitest";
import { WALL_HEIGHT } from "../world/builder";
import { NameTagPlacement } from "./nameTagPlacement";

describe("NameTagPlacement", () => {
  it("keeps a tag where it was asked to be when there is room", () => {
    expect(NameTagPlacement.centerY(2.0, 0.8)).toBe(2.0);
  });

  it("never lets the top of a tag go through the ceiling", () => {
    const planeHeight = 0.8;
    const y = NameTagPlacement.centerY(3.4, planeHeight);
    expect(y + planeHeight / 2).toBeLessThan(WALL_HEIGHT);
  });
});
