import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import type { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import type { CosmeticSlot } from "./cosmeticSlots";

export type SlotAnchor = { x: number; y: number; z: number; scale: number };

export type BodyPaint = { theme: string | null; player: string };

export interface SlotAnchors {
  anchor(slot: CosmeticSlot): SlotAnchor;
}

export class IdentityAnchors implements SlotAnchors {
  private static readonly IDENTITY: SlotAnchor = { x: 0, y: 0, z: 0, scale: 1 };

  anchor(_slot: CosmeticSlot): SlotAnchor {
    return IdentityAnchors.IDENTITY;
  }
}

export interface BodyRig {
  readonly root: Mesh;
  setFace(materials: StandardMaterial[] | null): void;
  setPaint(paint: BodyPaint): void;
  dispose(): void;
}

export interface CorpseRig {
  readonly root: Mesh;
  readonly loadoutParent: TransformNode;
  dispose(): void;
}

export abstract class BodyShape implements SlotAnchors {
  abstract readonly id: string;
  abstract readonly originY: number;
  abstract anchor(slot: CosmeticSlot): SlotAnchor;
  abstract createRig(paint: BodyPaint): BodyRig;
  abstract createCorpse(paint: BodyPaint): CorpseRig;
}
