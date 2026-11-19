import type { BaseTexture } from "@babylonjs/core/Materials/Textures/baseTexture";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import { Color3 } from "@babylonjs/core/Maths/math.color";

export class PickupEmissiveLift {
  static readonly TARGET_LUMA = 0.4;
  static readonly MIN_GAIN = 0.4;
  static readonly MAX_GAIN = 3;
  static readonly FALLBACK_GAIN = 1;

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
    const texture = material.diffuseTexture;
    if (!texture) {
      const luma = PickupEmissiveLift.luma(material.diffuseColor.r, material.diffuseColor.g, material.diffuseColor.b);
      const gain = PickupEmissiveLift.gainFor(luma);
      material.emissiveColor = new Color3(
        Math.min(1, material.diffuseColor.r * gain),
        Math.min(1, material.diffuseColor.g * gain),
        Math.min(1, material.diffuseColor.b * gain),
      );
      return;
    }
    material.emissiveTexture = texture;
    PickupEmissiveLift.setGain(material, PickupEmissiveLift.FALLBACK_GAIN);
    const measure = (): void => {
      void PickupEmissiveLift.meanLuma(texture)
        .then((luma) => PickupEmissiveLift.setGain(material, PickupEmissiveLift.gainFor(luma)))
        .catch(() => {});
    };
    if (texture.isReady()) measure();
    else if (texture instanceof Texture) texture.onLoadObservable.addOnce(measure);
  }

  private static setGain(material: StandardMaterial, gain: number): void {
    material.emissiveColor = new Color3(gain, gain, gain);
  }

  private static gainFor(luma: number): number {
    const wanted = PickupEmissiveLift.TARGET_LUMA / Math.max(luma, 0.01);
    return Math.min(PickupEmissiveLift.MAX_GAIN, Math.max(PickupEmissiveLift.MIN_GAIN, wanted));
  }

  private static luma(r: number, g: number, b: number): number {
    return 0.299 * r + 0.587 * g + 0.114 * b;
  }

  private static async meanLuma(texture: BaseTexture): Promise<number> {
    const pixels = await texture.readPixels();
    if (!pixels) return PickupEmissiveLift.TARGET_LUMA;
    const data = new Uint8Array(pixels.buffer, pixels.byteOffset, pixels.byteLength);
    let sum = 0;
    let count = 0;
    for (let i = 0; i + 3 < data.length; i += 4) {
      if (data[i + 3] < 8) continue;
      sum += PickupEmissiveLift.luma(data[i], data[i + 1], data[i + 2]) / 255;
      count++;
    }
    return count === 0 ? PickupEmissiveLift.TARGET_LUMA : sum / count;
  }
}
