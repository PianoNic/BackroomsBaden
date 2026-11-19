import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import { Color3 } from "@babylonjs/core/Maths/math.color";

export class PickupEmissiveLift {
  static readonly LEVEL = 0.4;

  static apply(meshes: readonly Mesh[]): void {
    const seen = new Set<StandardMaterial>();
    for (const mesh of meshes) {
      const material = mesh.material;
      if (!(material instanceof StandardMaterial) || seen.has(material)) continue;
      seen.add(material);
      PickupEmissiveLift.lift(material);
    }
  }

  private static lift(material: StandardMaterial): void {
    if (material.emissiveTexture) return;
    if (material.diffuseTexture) {
      material.emissiveTexture = material.diffuseTexture;
      material.emissiveColor = new Color3(
        PickupEmissiveLift.LEVEL, PickupEmissiveLift.LEVEL, PickupEmissiveLift.LEVEL,
      );
      return;
    }
    material.emissiveColor = material.diffuseColor.scale(PickupEmissiveLift.LEVEL);
  }
}
