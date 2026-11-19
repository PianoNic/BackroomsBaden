import { WALL_HEIGHT } from "../world/builder";

export type TagPlacement = { centerY: number; scale: number };

export class NameTagPlacement {
  static readonly CEILING_GAP = 0.05;
  static readonly MIN_CLEARANCE = 0.06;
  static readonly MIN_SCALE = 0.55;

  static centerY(wantedCenterY: number, planeHeight: number): number {
    const highest = WALL_HEIGHT - NameTagPlacement.CEILING_GAP - planeHeight / 2;
    return Math.min(wantedCenterY, highest);
  }

  static place(topY: number, planeHeight: number, clearance: number): TagPlacement {
    const ceiling = WALL_HEIGHT - NameTagPlacement.CEILING_GAP;
    const wantedBottom = topY + clearance;
    if (wantedBottom + planeHeight <= ceiling) {
      return { centerY: wantedBottom + planeHeight / 2, scale: 1 };
    }
    const lowestBottom = topY + NameTagPlacement.MIN_CLEARANCE;
    if (lowestBottom + planeHeight <= ceiling) {
      return { centerY: ceiling - planeHeight / 2, scale: 1 };
    }
    const fit = (ceiling - lowestBottom) / planeHeight;
    const scale = Math.min(1, Math.max(NameTagPlacement.MIN_SCALE, fit));
    return { centerY: ceiling - (planeHeight * scale) / 2, scale };
  }
}
