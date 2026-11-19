import { RoomInference, ROOM_ARCHETYPES, type RoomArchetype } from "../../src/world/rooms";
import type { Grid, PickupKind, WorldInit } from "../../src/net/protocol";

export type Viewpoint = {
  name: string;
  x: number;
  z: number;
  lookX: number;
  lookZ: number;
  lookY: number;
  yaw?: number;
  measure: boolean;
};

export type Dir = { dx: number; dz: number };

const EYE_HEIGHT = 1.7;
const WINDOW = 4;
const AXES: Dir[] = [
  { dx: 0, dz: -1 }, { dx: 1, dz: 0 }, { dx: 0, dz: 1 }, { dx: -1, dz: 0 },
];
const DIAGONALS: Dir[] = [
  { dx: 1, dz: -1 }, { dx: 1, dz: 1 }, { dx: -1, dz: 1 }, { dx: -1, dz: -1 },
].map((d) => ({ dx: d.dx * Math.SQRT1_2, dz: d.dz * Math.SQRT1_2 }));
const ALL_DIRS: Dir[] = [...AXES, ...DIAGONALS];
const PICKUP_KINDS: PickupKind[] = ["medkit", "potion", "compass", "tracker", "goggles", "gps"];

export class FloorMap {
  readonly corridor: Uint8Array;

  constructor(readonly grid: Grid) {
    this.corridor = this.computeCorridors();
  }

  cellOf(value: number): number {
    return Math.floor(value / this.grid.cellSize);
  }

  centre(cell: number): number {
    return (cell + 0.5) * this.grid.cellSize;
  }

  isFloorCell(cx: number, cz: number): boolean {
    const { width, height, cells } = this.grid;
    return cx >= 0 && cz >= 0 && cx < width && cz < height && cells[cz * width + cx] === 1;
  }

  isFloorAt(x: number, z: number): boolean {
    return this.isFloorCell(this.cellOf(x), this.cellOf(z));
  }

  isCorridorCell(cx: number, cz: number): boolean {
    const { width, height } = this.grid;
    return cx >= 0 && cz >= 0 && cx < width && cz < height && this.corridor[cz * width + cx] === 1;
  }

  clearDistance(x: number, z: number, dir: Dir, max: number): number {
    const step = 0.25;
    let travelled = 0;
    while (travelled < max) {
      const next = travelled + step;
      if (!this.isFloorAt(x + dir.dx * next, z + dir.dz * next)) return travelled;
      travelled = next;
    }
    return max;
  }

  private computeCorridors(): Uint8Array {
    const { width, height } = this.grid;
    const inWindow = new Uint8Array(width * height);
    for (let y = 0; y + WINDOW <= height; y++) {
      for (let x = 0; x + WINDOW <= width; x++) {
        if (!this.windowIsFloor(x, y)) continue;
        for (let wy = y; wy < y + WINDOW; wy++) {
          for (let wx = x; wx < x + WINDOW; wx++) inWindow[wy * width + wx] = 1;
        }
      }
    }
    const corridor = new Uint8Array(width * height);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (this.isFloorCell(x, y) && !inWindow[y * width + x]) corridor[y * width + x] = 1;
      }
    }
    return corridor;
  }

  private windowIsFloor(x: number, y: number): boolean {
    for (let wy = y; wy < y + WINDOW; wy++) {
      for (let wx = x; wx < x + WINDOW; wx++) if (!this.isFloorCell(wx, wy)) return false;
    }
    return true;
  }
}

export class ViewpointPlanner {
  readonly floor: FloorMap;
  readonly rooms: RoomInference;
  readonly skipped: string[] = [];

  constructor(private readonly init: WorldInit) {
    this.floor = new FloorMap(init.grid);
    this.rooms = new RoomInference(init.grid, init.props);
  }

  static pickupKinds(): PickupKind[] {
    return PICKUP_KINDS;
  }

  atrium(): Viewpoint {
    const { x, z, yaw } = this.init.spawn;
    return { name: "atrium", x, z, lookX: x, lookZ: z, lookY: EYE_HEIGHT, yaw, measure: true };
  }

  corridor(): Viewpoint | null {
    const { width, height, cellSize } = this.init.grid;
    let best: { cx: number; cz: number; dir: Dir; length: number } | null = null;
    for (const dir of [AXES[1], AXES[2]]) {
      for (let cz = 0; cz < height; cz++) {
        for (let cx = 0; cx < width; cx++) {
          if (!this.floor.isCorridorCell(cx, cz)) continue;
          if (this.floor.isCorridorCell(cx - dir.dx, cz - dir.dz)) continue;
          let length = 0;
          while (this.floor.isCorridorCell(cx + dir.dx * length, cz + dir.dz * length)) length++;
          if (!best || length > best.length) best = { cx, cz, dir, length };
        }
      }
    }
    if (!best) return this.skip("corridor");
    const x = this.floor.centre(best.cx);
    const z = this.floor.centre(best.cz);
    return {
      name: "corridor", x, z,
      lookX: x + best.dir.dx * best.length * cellSize,
      lookZ: z + best.dir.dz * best.length * cellSize,
      lookY: EYE_HEIGHT, measure: true,
    };
  }

  junction(): Viewpoint | null {
    const { width, height } = this.init.grid;
    let best: { cx: number; cz: number; arms: Dir[] } | null = null;
    for (let cz = 0; cz < height; cz++) {
      for (let cx = 0; cx < width; cx++) {
        if (!this.floor.isCorridorCell(cx, cz)) continue;
        const arms = AXES.filter((d) => this.armLength(cx, cz, d) >= WINDOW);
        if (arms.length >= 3 && (!best || arms.length > best.arms.length)) best = { cx, cz, arms };
      }
    }
    if (!best) return this.skip("junction");
    const found = best;
    const standDir = found.arms.reduce((a, b) =>
      this.armLength(found.cx, found.cz, a) >= this.armLength(found.cx, found.cz, b) ? a : b);
    const back = Math.min(this.armLength(found.cx, found.cz, standDir), 5);
    return {
      name: "junction",
      x: this.floor.centre(found.cx + standDir.dx * back),
      z: this.floor.centre(found.cz + standDir.dz * back),
      lookX: this.floor.centre(found.cx), lookZ: this.floor.centre(found.cz),
      lookY: EYE_HEIGHT, measure: true,
    };
  }

  roomViews(): Viewpoint[] {
    const result: Viewpoint[] = [];
    for (const archetype of ROOM_ARCHETYPES) {
      if (archetype === "hallway") continue;
      const view = this.room(archetype);
      if (view) result.push(view);
    }
    return result;
  }

  pickup(kind: PickupKind): Viewpoint | null {
    const pickup = this.init.pickups.find((p) => p.kind === kind);
    if (!pickup) return this.skip(`pickup-${kind}`);
    return this.facing(`pickup-${kind}`, pickup.x, pickup.z, 1.5, 0.25);
  }

  door(): Viewpoint | null {
    const door = this.init.doors[0];
    if (!door) return this.skip("door");
    return this.facing("door", door.x, door.z, 3, 1.2, AXES);
  }

  facing(
    name: string, targetX: number, targetZ: number, distance: number, lookY: number,
    dirs: Dir[] = ALL_DIRS,
  ): Viewpoint | null {
    for (const dir of dirs) {
      if (this.floor.clearDistance(targetX, targetZ, dir, distance) < distance) continue;
      return {
        name, x: targetX + dir.dx * distance, z: targetZ + dir.dz * distance,
        lookX: targetX, lookZ: targetZ, lookY, measure: false,
      };
    }
    return this.skip(name);
  }

  longestClear(x: number, z: number, max: number): { dir: Dir; distance: number } {
    let best = { dir: AXES[0], distance: -1 };
    for (const dir of AXES) {
      const distance = this.floor.clearDistance(x, z, dir, max);
      if (distance > best.distance) best = { dir, distance };
    }
    return best;
  }

  private room(archetype: RoomArchetype): Viewpoint | null {
    const candidates = this.rooms.rooms.filter((r) => r.archetype === archetype);
    if (candidates.length === 0) return this.skip(`room-${archetype}`);
    const area = (r: { minX: number; maxX: number; minY: number; maxY: number }): number =>
      (r.maxX - r.minX + 1) * (r.maxY - r.minY + 1);
    const room = candidates.reduce((a, b) => (area(b) > area(a) ? b : a));
    const centreX = this.floor.centre((room.minX + room.maxX) / 2);
    const centreZ = this.floor.centre((room.minY + room.maxY) / 2);
    let bestCell: { cx: number; cz: number; dist: number } | null = null;
    for (let cz = room.minY; cz <= room.maxY; cz++) {
      for (let cx = room.minX; cx <= room.maxX; cx++) {
        if (!this.floor.isFloorCell(cx, cz)) continue;
        const dist = Math.hypot(this.floor.centre(cx) - centreX, this.floor.centre(cz) - centreZ);
        if (!bestCell || dist > bestCell.dist) bestCell = { cx, cz, dist };
      }
    }
    if (!bestCell) return this.skip(`room-${archetype}`);
    return {
      name: `room-${archetype}`,
      x: this.floor.centre(bestCell.cx), z: this.floor.centre(bestCell.cz),
      lookX: centreX, lookZ: centreZ, lookY: EYE_HEIGHT, measure: true,
    };
  }

  private armLength(cx: number, cz: number, dir: Dir): number {
    let length = 0;
    while (length < 8 && this.floor.isCorridorCell(cx + dir.dx * (length + 1), cz + dir.dz * (length + 1))) length++;
    return length;
  }

  private skip(name: string): null {
    this.skipped.push(name);
    return null;
  }
}
