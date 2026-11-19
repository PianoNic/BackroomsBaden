import "@babylonjs/loaders/glTF/2.0";
import type { Scene } from "@babylonjs/core/scene";
import type { AssetContainer } from "@babylonjs/core/assetContainer";
import type { Material } from "@babylonjs/core/Materials/material";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { LoadAssetContainerAsync } from "@babylonjs/core/Loading/sceneLoader";
import { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { activeScene, group } from "../rendering/babylon";
import { ModelMaterialFactory } from "../rendering/modelMaterials";

export class CosmeticModelCache {
  private scene: Scene | null = null;
  private readonly pending = new Map<string, Promise<AssetContainer | null>>();
  private readonly resolved = new Map<string, AssetContainer>();
  private readonly materials = new ModelMaterialFactory();

  load(url: string): Promise<AssetContainer | null> {
    const scene = activeScene();
    if (scene !== this.scene) {
      this.reset();
      this.scene = scene;
    }
    const cached = this.pending.get(url);
    if (cached) return cached;
    const promise = LoadAssetContainerAsync(url, scene)
      .then((container) => {
        this.stage(container);
        this.resolved.set(url, container);
        return container;
      })
      .catch((err: unknown) => {
        console.warn(`CosmeticModelCache: failed to load ${url}`, err);
        return null;
      });
    this.pending.set(url, promise);
    return promise;
  }

  has(url: string): boolean {
    return this.scene === activeScene() && this.resolved.has(url);
  }

  instantiate(url: string, name: string): TransformNode | null {
    if (!this.has(url)) return null;
    const container = this.resolved.get(url)!;
    const entries = container.instantiateModelsToScene(
      (source) => `${name}_${source}`, false, { doNotInstantiate: false },
    );
    const root = group(name);
    for (const node of entries.rootNodes) {
      node.parent = root;
      this.prepare(node as TransformNode);
    }
    return root;
  }

  dispose(): void {
    this.reset();
  }

  private prepare(node: TransformNode): void {
    for (const mesh of node.getChildMeshes(false)) mesh.isPickable = false;
    if ("isPickable" in node) (node as Mesh).isPickable = false;
  }

  private stage(container: AssetContainer): void {
    container.addAllToScene();
    const seen = new Set<Material>();
    for (const mesh of container.meshes) {
      mesh.isVisible = false;
      mesh.isPickable = false;
      let mat = mesh.material;
      if (mat instanceof PBRMaterial) {
        mat = this.materials.standardFor(mat);
        mesh.material = mat;
      }
      if (mat && !seen.has(mat)) {
        seen.add(mat);
        const tex = (mat as { diffuseTexture?: Texture | null }).diffuseTexture;
        if (tex) tex.updateSamplingMode(Texture.NEAREST_SAMPLINGMODE);
        mat.freeze();
      }
    }
  }

  private reset(): void {
    for (const container of this.resolved.values()) container.dispose();
    this.resolved.clear();
    this.pending.clear();
    this.scene = null;
  }
}

export const cosmeticModels = new CosmeticModelCache();
