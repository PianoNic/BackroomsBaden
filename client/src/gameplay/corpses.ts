import type { InteractTarget } from "../ui/interactPrompt";
import type { Mesh } from "../rendering/babylon";
import { group } from "../rendering/babylon";
import { BodyShapes } from "./bodyShapes";
import type { CorpseRig } from "./bodyShape";
import type { EquippedCosmetics } from "../net/protocol";
import { themeColor } from "./cosmeticStyle";
import { CosmeticLoadout } from "./cosmeticLoadout";

const REVIVE_RADIUS = 2.2;

type Entry = {
  id: string; x: number; z: number; mesh: Mesh; rig: CorpseRig; loadout: CosmeticLoadout;
};

/** Tracks downed-player markers. Each corpse keeps its server id so the
 *  interact prompt can target a specific revive. */
export class Corpses {
  readonly group = group("corpses");
  private readonly entries = new Map<string, Entry>();

  add(
    id: string, x: number, z: number, color: string,
    equipped: EquippedCosmetics = {},
  ): void {
    if (this.entries.has(id)) return;
    const shape = BodyShapes.current();
    const rig = shape.createCorpse({ theme: themeColor(equipped), player: color });
    const mesh = rig.root;
    mesh.position.x = x;
    mesh.position.z = z;
    mesh.rotation.y = Math.random() * Math.PI * 2;
    this.group.add(mesh);

    const loadout = new CosmeticLoadout(rig.loadoutParent, () => {}, shape);
    loadout.set(equipped);

    this.entries.set(id, { id, x, z, mesh, rig, loadout });
  }

  remove(id: string): void {
    const e = this.entries.get(id);
    if (!e) return;
    e.loadout.dispose();
    this.group.remove(e.mesh);
    e.rig.dispose();
    this.entries.delete(id);
  }

  /** Targets for [E] revive — caller must check that medkit count > 0. */
  getInteractTargets(enabled: boolean): InteractTarget[] {
    if (!enabled || this.entries.size === 0) return [];
    const out: InteractTarget[] = [];
    for (const e of this.entries.values()) {
      out.push({
        x: e.x, z: e.z, radius: REVIVE_RADIUS,
        label: "hold E: revive", kind: "corpse", corpseId: e.id,
        anchorX: e.x, anchorY: 1.0, anchorZ: e.z,
      });
    }
    return out;
  }
}
