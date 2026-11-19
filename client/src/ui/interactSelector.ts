import type { InteractTarget } from "./interactPrompt";

export type SelectorPose = {
  x: number;
  z: number;
  forwardX: number;
  forwardZ: number;
};

export class InteractSelector {
  static readonly MIN_DOT = 0.55;
  static readonly RANGE_PAD = 1.5;
  static readonly QUEST_BONUS = 0.5;

  static pick(targets: InteractTarget[], pose: SelectorPose): InteractTarget | null {
    let best: InteractTarget | null = null;
    let bestScore = -Infinity;
    for (const t of targets) {
      const reach = t.radius * InteractSelector.RANGE_PAD;
      const dx = t.x - pose.x;
      const dz = t.z - pose.z;
      const distSq = dx * dx + dz * dz;
      if (distSq > reach * reach) continue;
      const dist = Math.sqrt(distSq) || 1;
      const dot = (pose.forwardX * dx + pose.forwardZ * dz) / dist;
      if (dot <= InteractSelector.MIN_DOT) continue;
      const score = dot + (t.kind === "quest" ? InteractSelector.QUEST_BONUS : 0);
      if (score > bestScore) {
        bestScore = score;
        best = t;
      }
    }
    return best;
  }
}
