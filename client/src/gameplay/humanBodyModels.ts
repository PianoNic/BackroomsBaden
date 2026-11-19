import "@babylonjs/loaders/glTF/2.0";
import type { Scene } from "@babylonjs/core/scene";
import type { AssetContainer } from "@babylonjs/core/assetContainer";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { LoadAssetContainerAsync } from "@babylonjs/core/Loading/sceneLoader";
import { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import type { BaseTexture } from "@babylonjs/core/Materials/Textures/baseTexture";
import { activeScene, group } from "../rendering/babylon";
import { ModelMaterialFactory } from "../rendering/modelMaterials";
import { RetroTextureStyle } from "../rendering/retroTextureStyle";

type Tint = { material: StandardMaterial; refs: number };

export class HumanBodyModels {
  static readonly URL = "/models/characters/body_human.glb";
  static readonly NEUTRAL = "neutral";

  private scene: Scene | null = null;
  private pending: Promise<boolean> | null = null;
  private container: AssetContainer | null = null;
  private source: StandardMaterial | null = null;
  private readonly tints = new Map<string, Tint>();
  private readonly factory = new ModelMaterialFactory();
  private serial = 0;

  load(): Promise<boolean> {
    const scene = activeScene();
    if (scene !== this.scene) {
      this.reset();
      this.scene = scene;
    }
    if (this.pending) return this.pending;
    this.pending = LoadAssetContainerAsync(HumanBodyModels.URL, scene)
      .then((container) => this.stage(container))
      .catch((err: unknown) => {
        console.warn("HumanBodyModels: failed to load the body model", err);
        return false;
      });
    return this.pending;
  }

  ready(): boolean {
    return this.scene === activeScene() && this.container !== null;
  }

  spawn(name: string): { root: TransformNode; mesh: Mesh } | null {
    if (!this.ready() || !this.container) return null;
    const entries = this.container.instantiateModelsToScene(
      (source) => `${name}_${source}`, false, { doNotInstantiate: true },
    );
    const root = group(name);
    for (const node of entries.rootNodes) node.parent = root;
    const meshes = root.getChildMeshes(false).filter((m) => m.getTotalVertices() > 0) as Mesh[];
    for (const mesh of root.getChildMeshes(false)) {
      mesh.isPickable = false;
      mesh.isVisible = true;
    }
    return { root, mesh: meshes[0] };
  }

  acquire(colour: string | null): StandardMaterial {
    const key = colour ?? HumanBodyModels.NEUTRAL;
    const existing = this.tints.get(key);
    if (existing) {
      existing.refs += 1;
      return existing.material;
    }
    const material = this.build(colour, key);
    this.tints.set(key, { material, refs: 1 });
    return material;
  }

  release(colour: string | null): void {
    const key = colour ?? HumanBodyModels.NEUTRAL;
    const tint = this.tints.get(key);
    if (!tint) return;
    tint.refs -= 1;
    if (tint.refs > 0) return;
    this.tints.delete(key);
    tint.material.dispose(false, false);
  }

  tintCount(): number {
    return this.tints.size;
  }

  private build(colour: string | null, key: string): StandardMaterial {
    const material = new StandardMaterial(`bodyTint_${key}_${this.serial++}`, activeScene());
    const source = this.source;
    if (source) {
      material.diffuseTexture = source.diffuseTexture;
      material.backFaceCulling = source.backFaceCulling;
    }
    material.diffuseColor = colour ? Color3.FromHexString(colour) : Color3.White();
    material.specularColor = Color3.Black();
    material.maxSimultaneousLights = 1;
    return material;
  }

  private stage(container: AssetContainer): boolean {
    container.addAllToScene();
    for (const mesh of container.meshes) {
      mesh.isVisible = false;
      mesh.isPickable = false;
      const original = mesh.material;
      if (original instanceof PBRMaterial) {
        this.source = this.factory.standardFor(original);
        mesh.material = this.source;
      }
    }
    const texture = (this.source as { diffuseTexture?: BaseTexture | null } | null)?.diffuseTexture;
    if (texture) RetroTextureStyle.apply(texture);
    this.factory.releaseSources(container);
    this.container = container;
    return true;
  }

  private reset(): void {
    this.tints.clear();
    this.container?.dispose();
    this.container = null;
    this.source = null;
    this.pending = null;
    this.scene = null;
  }
}

export const humanBodyModels = new HumanBodyModels();
