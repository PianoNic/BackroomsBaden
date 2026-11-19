import type { AssetContainer } from "@babylonjs/core/assetContainer";
import type { BaseTexture } from "@babylonjs/core/Materials/Textures/baseTexture";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import type { Scene } from "@babylonjs/core/scene";
import { activeScene } from "./babylon";

export class RetroTextureStyle {
  static readonly SAMPLING_MODE = Texture.NEAREST_SAMPLINGMODE;
  static readonly ANISOTROPY = 1;

  static apply<T extends BaseTexture>(texture: T): T {
    texture.anisotropicFilteringLevel = RetroTextureStyle.ANISOTROPY;
    if (texture instanceof Texture) {
      texture.updateSamplingMode(RetroTextureStyle.SAMPLING_MODE);
    }
    return texture;
  }

  static load(
    url: string, options: { scene?: Scene; invertY?: boolean } = {},
  ): Texture {
    return new Texture(
      url,
      options.scene ?? activeScene(),
      true,
      options.invertY ?? true,
      RetroTextureStyle.SAMPLING_MODE,
    );
  }

  static applyToContainer(container: AssetContainer): void {
    for (const texture of container.textures) RetroTextureStyle.apply(texture);
  }
}
