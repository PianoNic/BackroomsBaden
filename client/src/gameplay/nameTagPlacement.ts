import { WALL_HEIGHT } from "../world/builder";

export type TagPlacement = { centerY: number; scale: number; forward: number };

export class NameTagPlacement {
  static readonly PLAYER_RADIUS = 0.4;
  static readonly CEILING_GAP = 0.05;
  static readonly MIN_CLEARANCE = 0.06;
  static readonly MIN_SCALE = 0.85;
  static readonly SCALE_STEPS = [1, 0.95, 0.9, 0.85];
  static readonly MAX_PUSH = NameTagPlacement.PLAYER_RADIUS * 0.625;
  static readonly PUSH_MARGIN = 0.03;

  static centerY(wantedCenterY: number, planeHeight: number): number {
    const highest = WALL_HEIGHT - NameTagPlacement.CEILING_GAP - planeHeight / 2;
    return Math.min(wantedCenterY, highest);
  }

  static place(
    topY: number, planeHeight: number, clearance: number,
    radiusAt: (bottomY: number) => number = () => 0,
  ): TagPlacement {
    const ceiling = WALL_HEIGHT - NameTagPlacement.CEILING_GAP;
    const wantedBottom = topY + clearance;
    if (wantedBottom + planeHeight <= ceiling) {
      return { centerY: wantedBottom + planeHeight / 2, scale: 1, forward: 0 };
    }
    const lowestBottom = topY + NameTagPlacement.MIN_CLEARANCE;
    if (lowestBottom + planeHeight <= ceiling) {
      return { centerY: ceiling - planeHeight / 2, scale: 1, forward: 0 };
    }
    const candidates = NameTagPlacement.SCALE_STEPS.map((scale): TagPlacement & { push: number } => {
      const height = planeHeight * scale;
      const bottom = ceiling - height;
      const radius = bottom >= topY ? 0 : radiusAt(bottom);
      const push = radius > 0 ? radius + NameTagPlacement.PUSH_MARGIN : 0;
      return {
        centerY: ceiling - height / 2, scale, push,
        forward: Math.min(push, NameTagPlacement.MAX_PUSH),
      };
    });
    const chosen = candidates.find((c) => c.push === 0)
      ?? candidates.find((c) => c.push <= NameTagPlacement.MAX_PUSH)
      ?? candidates[candidates.length - 1];
    return { centerY: chosen.centerY, scale: chosen.scale, forward: chosen.forward };
  }
}
