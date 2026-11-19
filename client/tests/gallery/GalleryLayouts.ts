import type { DoorInfo, Grid, LockerInfo } from "../../src/net/protocol";

export type Layout = {
  grid: Grid;
  player: [number, number];
  locker: LockerInfo | null;
  door: DoorInfo | null;
};

export class GalleryLayouts {
  static readonly SIZE = 14;
  static readonly CELL = 2;
  static readonly WALL_ROW = 5;
  static readonly WALL_COLUMN = 4;
  static readonly DOORWAY_COLUMN = 7;
  static readonly COLLISION_RADIUS = 0.4;
  static readonly PANEL_HALF = 0.025;
  static readonly NAMES = ["wall", "corner", "doorway", "door", "locker"] as const;

  private static grid(isWall: (x: number, y: number) => boolean): Grid {
    const size = GalleryLayouts.SIZE;
    const cells: number[] = [];
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) cells.push(isWall(x, y) ? 0 : 1);
    }
    return { width: size, height: size, cellSize: GalleryLayouts.CELL, cells };
  }

  private static wallFace(): number {
    return (GalleryLayouts.WALL_ROW + 1) * GalleryLayouts.CELL;
  }

  private static columnFace(): number {
    return (GalleryLayouts.WALL_COLUMN + 1) * GalleryLayouts.CELL;
  }

  static build(name: string): Layout {
    const row = GalleryLayouts.WALL_ROW;
    const pressedZ = GalleryLayouts.wallFace() + GalleryLayouts.COLLISION_RADIUS;
    if (name === "corner") {
      return {
        grid: GalleryLayouts.grid((x, y) => y === row || x === GalleryLayouts.WALL_COLUMN),
        player: [GalleryLayouts.columnFace() + GalleryLayouts.COLLISION_RADIUS, pressedZ],
        locker: null,
        door: null,
      };
    }
    if (name === "door") {
      const gap = GalleryLayouts.DOORWAY_COLUMN;
      const panelZ = (row + 0.5) * GalleryLayouts.CELL;
      return {
        grid: GalleryLayouts.grid((x, y) => y === row && x !== gap),
        player: [
          (gap + 0.5) * GalleryLayouts.CELL,
          panelZ + GalleryLayouts.PANEL_HALF + GalleryLayouts.COLLISION_RADIUS,
        ],
        locker: null,
        door: { id: "gallery_door", x: (gap + 0.5) * GalleryLayouts.CELL, z: panelZ, yaw: 0, isOpen: false },
      };
    }
    if (name === "doorway") {
      const gap = GalleryLayouts.DOORWAY_COLUMN;
      return {
        grid: GalleryLayouts.grid((x, y) => y === row && x !== gap),
        player: [gap * GalleryLayouts.CELL - GalleryLayouts.COLLISION_RADIUS, pressedZ],
        locker: null,
        door: null,
      };
    }
    const grid = GalleryLayouts.grid((_x, y) => y === row);
    const x = 6.5 * GalleryLayouts.CELL;
    const locker: LockerInfo | null = name === "locker"
      ? { id: "gallery_locker", x, z: GalleryLayouts.wallFace(), yaw: Math.PI, opened: false, has_item: false }
      : null;
    return { grid, player: [x, pressedZ], locker, door: null };
  }

  static distant(): Layout {
    const near = GalleryLayouts.build("wall");
    return { ...near, player: [near.player[0], GalleryLayouts.wallFace() + 3] };
  }
}
