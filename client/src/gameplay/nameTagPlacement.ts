import { WALL_HEIGHT } from "../world/builder";

export class NameTagPlacement {
  static readonly CEILING_GAP = 0.05;

  static centerY(wantedCenterY: number, planeHeight: number): number {
    const highest = WALL_HEIGHT - NameTagPlacement.CEILING_GAP - planeHeight / 2;
    return Math.min(wantedCenterY, highest);
  }
}
