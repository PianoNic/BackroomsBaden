import type { CatalogItem, CosmeticAttach, CosmeticCategory, EquippedCosmetics } from "../net/protocol";

export type CosmeticSlot = "head" | "back" | "face";

export type SlotSource =
  | { kind: "procedural"; key: string }
  | { kind: "model"; ref: string; url: string };

export type AttachPose = {
  x: number;
  y: number;
  z: number;
  scale: number;
  yaw: number;
  pitch: number;
};

export type SlotEntry = {
  slot: CosmeticSlot;
  item: CatalogItem;
  source: SlotSource;
};

export class CosmeticSlots {
  static readonly ORDER: readonly CosmeticSlot[] = ["head", "back", "face"];

  private static readonly BY_CATEGORY: Partial<Record<CosmeticCategory, CosmeticSlot>> = {
    hat: "head",
    backpack: "back",
    mask: "face",
  };

  private static readonly CATEGORY_OF: Record<CosmeticSlot, CosmeticCategory> = {
    head: "hat",
    back: "backpack",
    face: "mask",
  };

  static readonly IDENTITY: AttachPose = { x: 0, y: 0, z: 0, scale: 1, yaw: 0, pitch: 0 };

  static slotFor(category: CosmeticCategory): CosmeticSlot | null {
    return CosmeticSlots.BY_CATEGORY[category] ?? null;
  }

  static categoryFor(slot: CosmeticSlot): CosmeticCategory {
    return CosmeticSlots.CATEGORY_OF[slot];
  }

  static isModelRef(assetRef: string | undefined): boolean {
    return !!assetRef && assetRef.startsWith("models/");
  }

  static modelUrl(assetRef: string): string {
    return `/${assetRef}.glb`;
  }

  static resolveSource(assetRef: string | undefined): SlotSource | null {
    if (!assetRef) return null;
    if (CosmeticSlots.isModelRef(assetRef)) {
      return { kind: "model", ref: assetRef, url: CosmeticSlots.modelUrl(assetRef) };
    }
    return { kind: "procedural", key: assetRef };
  }

  static pose(attach: CosmeticAttach | null | undefined): AttachPose {
    if (!attach) return CosmeticSlots.IDENTITY;
    return {
      x: attach.x,
      y: attach.y,
      z: attach.z,
      scale: attach.scale > 0 ? attach.scale : 1,
      yaw: attach.yaw,
      pitch: attach.pitch,
    };
  }

  static entries(
    equipped: EquippedCosmetics,
    resolve: (id: string | undefined) => CatalogItem | undefined,
  ): SlotEntry[] {
    const out: SlotEntry[] = [];
    for (const slot of CosmeticSlots.ORDER) {
      const item = resolve(equipped[CosmeticSlots.CATEGORY_OF[slot]]);
      if (!item) continue;
      const source = CosmeticSlots.resolveSource(item.assetRef);
      if (!source) continue;
      out.push({ slot, item, source });
    }
    return out;
  }

  static heldModel(
    equipped: EquippedCosmetics,
    resolve: (id: string | undefined) => CatalogItem | undefined,
  ): { item: CatalogItem; url: string } | null {
    const item = resolve(equipped.handitem);
    if (!item || !CosmeticSlots.isModelRef(item.assetRef)) return null;
    return { item, url: CosmeticSlots.modelUrl(item.assetRef) };
  }
}
