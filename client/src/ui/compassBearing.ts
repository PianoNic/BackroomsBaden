export class CompassBearing {
  static angle(dx: number, dz: number, yaw: number): number {
    const sin = Math.sin(yaw);
    const cos = Math.cos(yaw);
    const right = dx * cos - dz * sin;
    const forward = -(dx * sin + dz * cos);
    return Math.atan2(right, forward);
  }
}
