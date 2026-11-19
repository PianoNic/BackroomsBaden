import type { Scene } from "@babylonjs/core/scene";
import type { EquippedCosmetics } from "../../src/net/protocol";
import type { RemotePlayers } from "../../src/gameplay/remotePlayers";
import { CosmeticSlots } from "../../src/gameplay/cosmeticSlots";
import { cosmeticModels } from "../../src/gameplay/cosmeticModels";
import { resolveCosmetic } from "../../src/gameplay/cosmetics";

export type SceneCounts = {
  meshes: number;
  materials: number;
  textures: number;
  transformNodes: number;
  geometries: number;
  skeletons: number;
  animationGroups: number;
};

export class LeakProbe {
  private static readonly AVATAR =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==";

  private stream: MediaStream | null = null;

  constructor(
    private readonly scene: Scene,
    private readonly remotes: RemotePlayers,
  ) {}

  counts(): SceneCounts {
    return {
      meshes: this.scene.meshes.length,
      materials: this.scene.materials.length,
      textures: this.scene.textures.length,
      transformNodes: this.scene.transformNodes.length,
      geometries: this.scene.geometries.length,
      skeletons: this.scene.skeletons.length,
      animationGroups: this.scene.animationGroups.length,
    };
  }

  async warm(loadouts: EquippedCosmetics[]): Promise<void> {
    const urls = new Set<string>();
    for (const equipped of loadouts) {
      for (const entry of CosmeticSlots.entries(equipped, resolveCosmetic)) {
        if (entry.source.kind === "model") urls.add(entry.source.url);
      }
    }
    await Promise.all([...urls].map((url) => cosmeticModels.load(url)));
  }

  join(id: string, equipped: EquippedCosmetics, avatar = false): void {
    this.remotes.add({
      id, color: "#a9b4c2", x: 3, z: 3, yaw: 0, equipped, name: `Leak ${id}`,
      avatar: avatar ? LeakProbe.AVATAR : null,
    });
  }

  equip(id: string, equipped: EquippedCosmetics): void {
    this.remotes.setCosmetic(id, equipped);
  }

  camera(id: string, on: boolean): void {
    if (!on) {
      this.remotes.setVideoStream(id, null);
      this.stream?.getTracks().forEach((track) => track.stop());
      this.stream = null;
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 16;
    this.stream = canvas.captureStream();
    this.remotes.setVideoStream(id, this.stream);
  }

  leave(id: string): void {
    this.remotes.remove(id);
  }

  settle(frames: number): Promise<void> {
    return new Promise((resolve) => {
      let left = frames;
      const step = (): void => {
        left -= 1;
        if (left <= 0) resolve();
        else requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }
}
