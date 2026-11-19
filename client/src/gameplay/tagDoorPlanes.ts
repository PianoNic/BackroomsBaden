export type ClipPlane = { nx: number; nz: number; d: number };

type DoorPanel = { x: number; z: number; yaw: number; closed: boolean };

export class TagDoorPlanes {
  static readonly NONE: ClipPlane = { nx: 0, nz: 0, d: -1 };

  private readonly doors = new Map<string, DoorPanel>();
  private revision = 0;

  constructor(private readonly cellSize: number) {}

  get version(): number {
    return this.revision;
  }

  cellOf(coordinate: number): number {
    return Math.floor(coordinate / this.cellSize);
  }

  setDoor(id: string, x: number, z: number, yaw: number, closed: boolean): void {
    const known = this.doors.get(id);
    if (known && known.closed === closed && known.x === x && known.z === z && known.yaw === yaw) return;
    this.doors.set(id, { x, z, yaw, closed });
    this.revision += 1;
  }

  planeAt(x: number, z: number): ClipPlane {
    const cellX = this.cellOf(x);
    const cellZ = this.cellOf(z);
    for (const door of this.doors.values()) {
      if (!door.closed) continue;
      if (this.cellOf(door.x) !== cellX || this.cellOf(door.z) !== cellZ) continue;
      return TagDoorPlanes.farSide(door, x, z);
    }
    return TagDoorPlanes.NONE;
  }

  private static farSide(door: DoorPanel, x: number, z: number): ClipPlane {
    const normalX = Math.round(Math.sin(door.yaw));
    const normalZ = Math.round(Math.cos(door.yaw));
    const side = (x - door.x) * normalX + (z - door.z) * normalZ;
    const sign = side >= 0 ? -1 : 1;
    const nx = normalX * sign;
    const nz = normalZ * sign;
    return { nx, nz, d: -(nx * door.x + nz * door.z) };
  }
}
