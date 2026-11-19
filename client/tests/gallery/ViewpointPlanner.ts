import type { Grid, PickupKind, Prop, WorldInit } from "../../src/net/protocol";

export type RoomArchetype =
  | "classroom" | "cafeteria" | "chemistry_lab" | "gym"
  | "janitor_room" | "server_room" | "teacher_room" | "toilet";

export type RoomBox = {
  archetype: RoomArchetype;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

type Signature = { strong: readonly string[]; weak: readonly string[] };

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
const ATRIUM_MIN_SIDE = 8;
const STRONG_WEIGHT = 3;
const WEAK_WEIGHT = 1;
const ROOM_ORDER: RoomArchetype[] = [
  "classroom", "cafeteria", "chemistry_lab", "gym",
  "janitor_room", "server_room", "teacher_room", "toilet",
];
const SIGNATURES: Partial<Record<RoomArchetype, Signature>> = {
  toilet: { strong: ["toilet_stall", "urinal"], weak: ["sink"] },
  server_room: { strong: ["server_rack"], weak: [] },
  gym: { strong: ["basketball_hoop", "gym_mat", "ball_rack", "pylon"], weak: [] },
  chemistry_lab: {
    strong: ["lab_bench", "fume_hood", "chemical_shelf", "bunsen_burner", "emergency_shower"],
    weak: ["microscope"],
  },
  cafeteria: { strong: ["cafeteria_table", "vending_machine", "counter", "microwave"], weak: [] },
  janitor_room: { strong: ["fuse_box", "mop_bucket"], weak: [] },
  teacher_room: { strong: ["sofa", "printer", "fridge", "side_table", "trophy_case"], weak: [] },
  classroom: {
    strong: ["student_desk", "whiteboard", "projector", "easel", "globe", "map", "skeleton"],
    weak: [],
  },
};
const PICKUP_KINDS: PickupKind[] = ["medkit", "potion", "compass", "tracker", "goggles", "gps"];

export class FloorMap {
  readonly corridor: Uint8Array;
  readonly roomMask: Uint8Array;

  constructor(readonly grid: Grid) {
    this.roomMask = this.computeRoomMask();
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

  private computeRoomMask(): Uint8Array {
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
    return inWindow;
  }

  private computeCorridors(): Uint8Array {
    const { width, height } = this.grid;
    const corridor = new Uint8Array(width * height);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (this.isFloorCell(x, y) && !this.roomMask[y * width + x]) corridor[y * width + x] = 1;
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

export class RoomClassifier {
  readonly rooms: RoomBox[] = [];
  atrium: { minX: number; minY: number; maxX: number; maxY: number } | null = null;

  constructor(floor: FloorMap, props: Prop[]) {
    const { width, height, cellSize } = floor.grid;
    const visited = new Uint8Array(width * height);
    const components: { minX: number; minY: number; maxX: number; maxY: number }[] = [];
    for (let start = 0; start < width * height; start++) {
      if (!floor.roomMask[start] || visited[start]) continue;
      const box = { minX: width, minY: height, maxX: -1, maxY: -1 };
      const stack = [start];
      visited[start] = 1;
      while (stack.length > 0) {
        const idx = stack.pop()!;
        const x = idx % width;
        const y = Math.floor(idx / width);
        box.minX = Math.min(box.minX, x);
        box.maxX = Math.max(box.maxX, x);
        box.minY = Math.min(box.minY, y);
        box.maxY = Math.max(box.maxY, y);
        for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const n = ny * width + nx;
          if (floor.roomMask[n] && !visited[n]) {
            visited[n] = 1;
            stack.push(n);
          }
        }
      }
      components.push(box);
    }
    const atrium = this.atriumIndex(components, width, height);
    this.atrium = atrium >= 0 ? components[atrium] : null;
    components.forEach((box, i) => {
      if (i !== atrium) this.rooms.push({ ...box, archetype: this.classify(box, props, cellSize) });
    });
  }

  private atriumIndex(
    boxes: { minX: number; minY: number; maxX: number; maxY: number }[], width: number, height: number,
  ): number {
    let best = -1;
    let bestDist = Infinity;
    boxes.forEach((b, i) => {
      if (b.maxX - b.minX + 1 < ATRIUM_MIN_SIDE || b.maxY - b.minY + 1 < ATRIUM_MIN_SIDE) return;
      const dx = (b.minX + b.maxX) / 2 - width / 2;
      const dy = (b.minY + b.maxY) / 2 - height / 2;
      const dist = dx * dx + dy * dy;
      if (dist < bestDist) {
        bestDist = dist;
        best = i;
      }
    });
    return best;
  }

  private classify(
    box: { minX: number; minY: number; maxX: number; maxY: number }, props: Prop[], cellSize: number,
  ): RoomArchetype {
    const scores = new Map<RoomArchetype, number>();
    for (const prop of props) {
      const cx = Math.floor(prop.x / cellSize);
      const cz = Math.floor(prop.z / cellSize);
      if (cx < box.minX || cx > box.maxX || cz < box.minY || cz > box.maxY) continue;
      for (const [archetype, sig] of Object.entries(SIGNATURES) as [RoomArchetype, Signature][]) {
        let add = 0;
        if (sig.strong.includes(prop.type)) add = STRONG_WEIGHT;
        else if (sig.weak.includes(prop.type)) add = WEAK_WEIGHT;
        if (add > 0) scores.set(archetype, (scores.get(archetype) ?? 0) + add);
      }
    }
    let bestScore = 0;
    for (const score of scores.values()) bestScore = Math.max(bestScore, score);
    if (bestScore === 0) return "classroom";
    const winners = [...scores].filter(([, score]) => score === bestScore).map(([a]) => a);
    return winners.length === 1 ? winners[0] : "classroom";
  }
}

export class ViewpointPlanner {
  readonly floor: FloorMap;
  readonly classifier: RoomClassifier;
  readonly skipped: string[] = [];

  constructor(private readonly init: WorldInit) {
    this.floor = new FloorMap(init.grid);
    this.classifier = new RoomClassifier(this.floor, init.props);
  }

  static pickupKinds(): PickupKind[] {
    return PICKUP_KINDS;
  }

  spawn(): Viewpoint {
    const { x, z, yaw } = this.init.spawn;
    return { name: "spawn", x, z, lookX: x, lookZ: z, lookY: EYE_HEIGHT, yaw, measure: true };
  }

  atrium(): Viewpoint | null {
    const box = this.classifier.atrium;
    if (!box) return this.skip("atrium");
    return {
      name: "atrium",
      x: this.floor.centre(box.minX + 1), z: this.floor.centre(box.minY + 1),
      lookX: this.floor.centre(box.maxX), lookZ: this.floor.centre(box.maxY),
      lookY: EYE_HEIGHT, measure: true,
    };
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
    for (const archetype of ROOM_ORDER) {
      const view = this.room(archetype);
      if (view) result.push(view);
    }
    return result;
  }

  pickup(kind: PickupKind, x: number, z: number, fromX: number, fromZ: number): Viewpoint | null {
    const len = Math.hypot(x - fromX, z - fromZ) || 1;
    const dir = { dx: (x - fromX) / len, dz: (z - fromZ) / len };
    return this.facing(`pickup-${kind}`, x, z, 0.8, 0.45, [dir, ...ALL_DIRS]);
  }

  lockersBySpawnDistance(): { id: string; x: number; z: number }[] {
    const { x, z } = this.init.spawn;
    return [...this.init.lockers].sort(
      (a, b) => Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z),
    );
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
    const candidates = this.classifier.rooms.filter((r) => r.archetype === archetype);
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
