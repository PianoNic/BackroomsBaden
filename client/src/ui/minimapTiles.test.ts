import { describe, expect, it } from "vitest";
import { MinimapTiles } from "./minimapTiles";

const W = 5;
const H = 5;

function room(): number[] {
  const cells = new Array<number>(W * H).fill(0);
  for (let y = 1; y <= 3; y++) for (let x = 1; x <= 3; x++) cells[y * W + x] = 1;
  return cells;
}

describe("MinimapTiles", () => {
  it("gives interior floor no wall sides", () => {
    expect(MinimapTiles.wallSides(room(), W, H, 2, 2)).toEqual([]);
  });

  it("marks the sides of a floor cell that face a wall", () => {
    expect(MinimapTiles.wallSides(room(), W, H, 1, 1).sort()).toEqual(["north", "west"]);
    expect(MinimapTiles.wallSides(room(), W, H, 3, 3).sort()).toEqual(["east", "south"]);
  });

  it("returns nothing for wall cells", () => {
    expect(MinimapTiles.wallSides(room(), W, H, 0, 0)).toEqual([]);
  });

  it("treats the grid border as wall", () => {
    const open = new Array<number>(W * H).fill(1);
    expect(MinimapTiles.wallSides(open, W, H, 0, 0).sort()).toEqual(["north", "west"]);
  });
});
