import { describe, expect, it } from "vitest";
import { PLANE_W } from "./nameTags";
import { NameTagPlacement } from "./nameTagPlacement";

const CELL_SIZE = 2;

class TagReach {
  static into(push: number): number {
    return PLANE_W / 2 - (NameTagPlacement.PLAYER_RADIUS - push);
  }
}

describe("name tag reach into a wall", () => {
  it("stays inside a one cell wall when the tag is pushed fully towards the far side", () => {
    expect(TagReach.into(NameTagPlacement.MAX_PUSH)).toBeLessThan(CELL_SIZE);
  });

  it("stays inside a one cell wall with no push", () => {
    expect(TagReach.into(0)).toBeLessThan(CELL_SIZE);
  });
});
