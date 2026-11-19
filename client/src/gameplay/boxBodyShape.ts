import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import type { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { box, group, lambertMaterial, Color3 } from "../rendering/babylon";
import type { CosmeticSlot } from "./cosmeticSlots";
import {
  BodyShape, IdentityAnchors, type BodyPaint, type BodyRig, type CorpseRig, type SlotAnchor,
} from "./bodyShape";
import {
  buildVoxelMesh, disposeVoxelMaterial, makeColorMaterial, setVoxelMaterial,
} from "./remotePlayerMaterials";

class BoxBodyRig implements BodyRig {
  readonly root: Mesh;
  private paint: BodyPaint;
  private faced = false;

  constructor(paint: BodyPaint) {
    this.paint = paint;
    this.root = buildVoxelMesh(0.6, 1.7, 0.6, makeColorMaterial(BoxBodyRig.colour(paint)));
  }

  private static colour(paint: BodyPaint): string {
    return paint.theme ?? paint.player;
  }

  setFace(materials: StandardMaterial[] | null): void {
    if (materials) {
      this.faced = true;
      setVoxelMaterial(this.root, materials);
      return;
    }
    this.faced = false;
    setVoxelMaterial(this.root, makeColorMaterial(BoxBodyRig.colour(this.paint)));
  }

  setPaint(paint: BodyPaint): void {
    this.paint = paint;
    if (!this.faced) setVoxelMaterial(this.root, makeColorMaterial(BoxBodyRig.colour(paint)));
  }

  dispose(): void {
    disposeVoxelMaterial(this.root);
    this.root.dispose(false, false);
  }
}

class BoxCorpseRig implements CorpseRig {
  readonly root: Mesh;
  readonly loadoutParent: TransformNode;
  private static readonly HEAD_X = 0.7;
  private static readonly HAT_BASE_Y = 0.85;

  constructor(paint: BodyPaint) {
    const mat = lambertMaterial(Color3.FromHexString(paint.theme ?? paint.player));
    this.root = box(1.6, 0.5, 0.6, mat);
    this.root.position.y = 0.25;
    const pivot = group("corpseBody");
    pivot.rotation.z = -Math.PI / 2;
    pivot.position.set(BoxCorpseRig.HEAD_X - BoxCorpseRig.HAT_BASE_Y, 0.15, 0);
    this.root.add(pivot);
    this.loadoutParent = pivot;
  }

  dispose(): void {
    this.root.dispose(false, true);
  }
}

export class BoxBodyShape extends BodyShape {
  readonly id = "box";
  readonly originY = 0.85;
  private readonly anchors = new IdentityAnchors();

  anchor(slot: CosmeticSlot): SlotAnchor {
    return this.anchors.anchor(slot);
  }

  createRig(paint: BodyPaint): BodyRig {
    return new BoxBodyRig(paint);
  }

  createCorpse(paint: BodyPaint): CorpseRig {
    return new BoxCorpseRig(paint);
  }
}
