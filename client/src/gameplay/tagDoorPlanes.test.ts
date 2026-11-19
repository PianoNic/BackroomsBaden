import { describe, expect, it } from "vitest";
import { TagDoorPlanes, type ClipPlane } from "./tagDoorPlanes";

const clipped = (plane: ClipPlane, x: number, z: number): boolean => plane.nx * x + plane.nz * z + plane.d > 0;

describe("TagDoorPlanes", () => {
  it("clips nothing when there is no door", () => {
    const plane = new TagDoorPlanes(2).planeAt(5, 5);
    for (const [x, z] of [[0, 0], [100, -100], [-50, 70]]) expect(clipped(plane, x, z)).toBe(false);
  });

  it("clips the far side of a closed door for a player on the south side", () => {
    const doors = new TagDoorPlanes(2);
    doors.setDoor("d", 5, 5, 0, true);
    const plane = doors.planeAt(5, 5.4);
    expect(clipped(plane, 5, 4.5)).toBe(true);
    expect(clipped(plane, 5, 5.5)).toBe(false);
  });

  it("clips the other side for a player on the north side", () => {
    const doors = new TagDoorPlanes(2);
    doors.setDoor("d", 5, 5, 0, true);
    const plane = doors.planeAt(5, 4.6);
    expect(clipped(plane, 5, 5.5)).toBe(true);
    expect(clipped(plane, 5, 4.5)).toBe(false);
  });

  it("turns with the door yaw", () => {
    const doors = new TagDoorPlanes(2);
    doors.setDoor("d", 5, 5, Math.PI / 2, true);
    const plane = doors.planeAt(5.4, 5);
    expect(clipped(plane, 4.5, 5)).toBe(true);
    expect(clipped(plane, 5.5, 5)).toBe(false);
  });

  it("ignores an open door and a door in another cell", () => {
    const doors = new TagDoorPlanes(2);
    doors.setDoor("d", 5, 5, 0, false);
    expect(clipped(doors.planeAt(5, 5.4), 5, 4.5)).toBe(false);
    doors.setDoor("d", 5, 5, 0, true);
    expect(clipped(doors.planeAt(9, 5.4), 5, 4.5)).toBe(false);
  });

  it("bumps the version only when a door changes", () => {
    const doors = new TagDoorPlanes(2);
    const start = doors.version;
    doors.setDoor("d", 5, 5, 0, true);
    expect(doors.version).toBe(start + 1);
    doors.setDoor("d", 5, 5, 0, true);
    expect(doors.version).toBe(start + 1);
    doors.setDoor("d", 5, 5, 0, false);
    expect(doors.version).toBe(start + 2);
  });
});
