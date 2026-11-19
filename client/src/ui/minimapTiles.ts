export type Side = "north" | "south" | "west" | "east";

export class MinimapTiles {
  static isFloor(cells: number[], width: number, height: number, x: number, y: number): boolean {
    if (x < 0 || y < 0 || x >= width || y >= height) return false;
    return cells[y * width + x] === 1;
  }

  static wallSides(cells: number[], width: number, height: number, x: number, y: number): Side[] {
    if (!MinimapTiles.isFloor(cells, width, height, x, y)) return [];
    const sides: Side[] = [];
    if (!MinimapTiles.isFloor(cells, width, height, x, y - 1)) sides.push("north");
    if (!MinimapTiles.isFloor(cells, width, height, x, y + 1)) sides.push("south");
    if (!MinimapTiles.isFloor(cells, width, height, x - 1, y)) sides.push("west");
    if (!MinimapTiles.isFloor(cells, width, height, x + 1, y)) sides.push("east");
    return sides;
  }
}
