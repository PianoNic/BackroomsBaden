import { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import type { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { activeScene, group, plane } from "../rendering/babylon";
import type { CosmeticSlot } from "./cosmeticSlots";
import {
  BodyShape, type BodyPaint, type BodyRig, type CorpseRig, type SlotAnchor,
} from "./bodyShape";
import { disposeMaterial } from "./remotePlayerMaterials";
import { humanBodyModels } from "./humanBodyModels";

class HumanProportions {
  static readonly SCALE = 0.94;
  static readonly ORIGIN_Y = 0.85;
  static readonly YAW = Math.PI;
  static readonly FACE_WIDTH = 0.17;
  static readonly FACE_HEIGHT = 0.19;
  static readonly FACE_CENTRE_Y = 1.66;
  static readonly FACE_FRONT_Z = 0.14;
  static readonly LIE_HEIGHT = 0.17;
  static readonly ANCHORS: Record<CosmeticSlot, SlotAnchor> = {
    head: { x: 0, y: 0.41, z: 0, scale: 0.5 },
    face: { x: 0, y: 0.572, z: -0.015, scale: 0.4 },
    back: { x: 0, y: 0.12, z: -0.1, scale: 0.8 },
  };
}

class HumanFigure {
  readonly face: Mesh;
  readonly mesh: Mesh;
  private readonly body: TransformNode;
  private colour: string | null;

  constructor(name: string, colour: string | null, parent: TransformNode) {
    const spawned = humanBodyModels.spawn(name);
    if (!spawned) throw new Error("human body model is not loaded");
    this.colour = colour;
    this.body = spawned.root;
    this.body.parent = parent;
    this.body.rotation.y = HumanProportions.YAW;
    this.body.scaling.setAll(HumanProportions.SCALE);
    this.body.position.y = -HumanProportions.ORIGIN_Y;
    spawned.mesh.material = humanBodyModels.acquire(colour);
    this.face = plane(HumanProportions.FACE_WIDTH, HumanProportions.FACE_HEIGHT, null, false, `${name}_face`);
    this.face.parent = parent;
    this.face.rotation.y = Math.PI;
    this.face.position.set(
      0,
      HumanProportions.FACE_CENTRE_Y * HumanProportions.SCALE - HumanProportions.ORIGIN_Y,
      -HumanProportions.FACE_FRONT_Z * HumanProportions.SCALE,
    );
    this.face.setEnabled(false);
    this.mesh = spawned.mesh;
  }

  setColour(colour: string | null): void {
    if (colour === this.colour) return;
    const next = humanBodyModels.acquire(colour);
    this.mesh.material = next;
    humanBodyModels.release(this.colour);
    this.colour = colour;
  }

  setFace(materials: StandardMaterial[] | null): void {
    const old = this.face.material as StandardMaterial | null;
    if (!materials) {
      this.face.material = null;
      this.face.setEnabled(false);
    } else {
      const front = materials[1];
      const rest = materials.filter((m) => m !== front);
      this.face.material = front;
      this.face.setEnabled(true);
      disposeMaterial(rest);
    }
    if (old && old !== this.face.material) disposeMaterial(old);
  }

  dispose(): void {
    const old = this.face.material as StandardMaterial | null;
    this.face.material = null;
    if (old) disposeMaterial(old);
    this.face.dispose(false, false);
    this.mesh.material = null;
    this.body.dispose(false, false);
    humanBodyModels.release(this.colour);
  }
}

class HumanBodyRig implements BodyRig {
  readonly root: Mesh;
  private readonly figure: HumanFigure;

  constructor(paint: BodyPaint) {
    this.root = new Mesh("humanBody", activeScene());
    this.root.isPickable = false;
    this.figure = new HumanFigure("human", paint.theme, this.root);
  }

  setFace(materials: StandardMaterial[] | null): void {
    this.figure.setFace(materials);
  }

  setPaint(paint: BodyPaint): void {
    this.figure.setColour(paint.theme);
  }

  dispose(): void {
    this.figure.dispose();
    this.root.dispose(false, false);
  }
}

class HumanCorpseRig implements CorpseRig {
  readonly root: Mesh;
  readonly loadoutParent: TransformNode;
  private readonly figure: HumanFigure;

  constructor(paint: BodyPaint) {
    this.root = new Mesh("humanCorpse", activeScene());
    this.root.isPickable = false;
    const lying = group("corpseBody");
    lying.parent = this.root;
    lying.rotation.x = Math.PI / 2;
    lying.position.y = HumanProportions.LIE_HEIGHT;
    this.loadoutParent = lying;
    this.figure = new HumanFigure("corpse", paint.theme, lying);
  }

  dispose(): void {
    this.figure.dispose();
    this.loadoutParent.dispose();
    this.root.dispose(false, false);
  }
}

export class HumanBodyShape extends BodyShape {
  readonly id = "human";
  readonly originY = HumanProportions.ORIGIN_Y;

  anchor(slot: CosmeticSlot): SlotAnchor {
    return HumanProportions.ANCHORS[slot];
  }

  createRig(paint: BodyPaint): BodyRig {
    return new HumanBodyRig(paint);
  }

  createCorpse(paint: BodyPaint): CorpseRig {
    return new HumanCorpseRig(paint);
  }
}
