import type { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import type { EquippedCosmetics } from "../net/protocol";
import { group } from "../rendering/babylon";
import { resolveCosmetic } from "./cosmetics";
import { CosmeticSlots, type CosmeticSlot, type SlotEntry } from "./cosmeticSlots";
import { cosmeticModels } from "./cosmeticModels";
import { buildHat, disposeHat } from "./remotePlayerMaterials";
import { IdentityAnchors, type SlotAnchors } from "./bodyShape";

type SlotState = {
  itemId: string;
  node: TransformNode;
  procedural: TransformNode | null;
};

export class CosmeticLoadout {
  readonly root: TransformNode;
  private readonly slots = new Map<CosmeticSlot, SlotState>();
  private readonly requested = new Map<CosmeticSlot, string>();
  private disposed = false;

  constructor(
    parent: TransformNode,
    private readonly onChange: () => void = () => {},
    private readonly anchors: SlotAnchors = new IdentityAnchors(),
  ) {
    this.root = group("cosmetics");
    this.root.parent = parent;
  }

  set(equipped: EquippedCosmetics): void {
    const wanted = new Map<CosmeticSlot, SlotEntry>();
    for (const entry of CosmeticSlots.entries(equipped, resolveCosmetic)) {
      wanted.set(entry.slot, entry);
    }
    for (const slot of CosmeticSlots.ORDER) {
      const entry = wanted.get(slot);
      const current = this.slots.get(slot);
      if (!entry) {
        this.requested.delete(slot);
        if (current) this.clearSlot(slot);
        continue;
      }
      if (this.requested.get(slot) === entry.item.id) continue;
      this.requested.set(slot, entry.item.id);
      if (current) this.clearSlot(slot);
      this.fill(entry);
    }
  }

  setEnabled(enabled: boolean): void {
    if (this.root.isEnabled(false) !== enabled) this.root.setEnabled(enabled);
  }

  isEnabled(): boolean {
    return this.root.isEnabled(false);
  }

  dispose(): void {
    this.disposed = true;
    for (const slot of [...this.slots.keys()]) this.clearSlot(slot);
    this.requested.clear();
    this.root.dispose();
  }

  private fill(entry: SlotEntry): void {
    const { slot, item, source } = entry;
    if (source.kind === "procedural") {
      const hat = slot === "head" ? buildHat(source.key) : null;
      if (!hat) return;
      const anchor = this.anchorNode(slot);
      const node = group(`slot_${slot}`);
      node.parent = anchor;
      hat.parent = node;
      this.slots.set(slot, { itemId: item.id, node: anchor, procedural: hat });
      return;
    }
    const place = () => {
      if (this.disposed || this.requested.get(slot) !== item.id) return;
      const model = cosmeticModels.instantiate(source.url, `cos_${item.id}`);
      if (!model) return;
      const anchor = this.anchorNode(slot);
      const node = group(`slot_${slot}`);
      node.parent = anchor;
      this.applyPose(node, item.attach);
      model.parent = node;
      this.slots.set(slot, { itemId: item.id, node: anchor, procedural: null });
      this.onChange();
    };
    if (cosmeticModels.has(source.url)) place();
    else void cosmeticModels.load(source.url).then(place);
  }

  private anchorNode(slot: CosmeticSlot): TransformNode {
    const anchor = this.anchors.anchor(slot);
    const node = group(`anchor_${slot}`);
    node.parent = this.root;
    node.position.set(anchor.x, anchor.y, anchor.z);
    node.scaling.setAll(anchor.scale);
    return node;
  }

  private applyPose(node: TransformNode, attach: Parameters<typeof CosmeticSlots.pose>[0]): void {
    const pose = CosmeticSlots.pose(attach);
    node.position.set(pose.x, pose.y, pose.z);
    node.scaling.setAll(pose.scale);
    node.rotation.set(pose.pitch, pose.yaw, 0);
  }

  private clearSlot(slot: CosmeticSlot): void {
    const state = this.slots.get(slot);
    if (!state) return;
    this.slots.delete(slot);
    if (state.procedural) disposeHat(state.procedural);
    state.node.dispose();
  }
}
