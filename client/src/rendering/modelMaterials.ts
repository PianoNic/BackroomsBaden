import type { IMaterialCompilationOptions, Material } from "@babylonjs/core/Materials/material";
import { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { AssetContainer } from "@babylonjs/core/assetContainer";
import type { BaseTexture } from "@babylonjs/core/Materials/Textures/baseTexture";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { RetroTextureStyle } from "./retroTextureStyle";

export function freezeWhenCompiled(
  material: Material,
  mesh: Mesh,
  options?: Partial<IMaterialCompilationOptions>,
): void {
  void material
    .forceCompilationAsync(mesh, options)
    .then(() => material.freeze())
    .catch(() => {});
}

export class ModelMaterialFactory {
  private readonly cache = new WeakMap<PBRMaterial, StandardMaterial>();
  private readonly scheduled = new WeakSet<StandardMaterial>();

  standardFor(source: PBRMaterial): StandardMaterial {
    const cached = this.cache.get(source);
    if (cached) return cached;

    const mat = new StandardMaterial(`${source.name}_std`, source.getScene());
    if (source.albedoTexture) {
      mat.diffuseTexture = RetroTextureStyle.apply(source.albedoTexture);
    }
    mat.diffuseColor = source.albedoColor.clone();
    mat.emissiveColor = source.emissiveColor.clone();
    if (source.emissiveTexture) {
      mat.emissiveTexture = RetroTextureStyle.apply(source.emissiveTexture);
    }
    mat.backFaceCulling = source.backFaceCulling;
    mat.alpha = source.alpha;
    mat.specularColor = Color3.Black();
    mat.maxSimultaneousLights = 1;

    if (source.needAlphaBlending()) {
      mat.transparencyMode = StandardMaterial.MATERIAL_ALPHABLEND;
    } else if (source.needAlphaTesting()) {
      mat.transparencyMode = StandardMaterial.MATERIAL_ALPHATEST;
      mat.alphaCutOff = source.alphaCutOff;
    }

    this.cache.set(source, mat);
    return mat;
  }

  releaseSources(container: AssetContainer): void {
    for (const material of [...container.materials]) {
      if (!(material instanceof PBRMaterial) || !this.cache.has(material)) continue;
      const kept = new Set<BaseTexture>(
        [material.albedoTexture, material.emissiveTexture].filter(
          (t): t is BaseTexture => t != null,
        ),
      );
      for (const texture of material.getActiveTextures()) {
        if (!kept.has(texture)) texture.dispose();
      }
      material.dispose(false, false);
      const index = container.materials.indexOf(material);
      if (index >= 0) container.materials.splice(index, 1);
    }
  }

  freezeWhenReady(
    material: StandardMaterial,
    mesh: Mesh,
    options?: Partial<IMaterialCompilationOptions>,
  ): void {
    if (this.scheduled.has(material)) return;
    this.scheduled.add(material);
    freezeWhenCompiled(material, mesh, options);
  }
}
