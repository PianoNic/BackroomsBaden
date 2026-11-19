import type { CatalogItem, EquippedCosmetics } from "../../src/net/protocol";

export type Vec3 = [number, number, number];

export type CameraShot = { name: string; position: Vec3; target: Vec3; crop: boolean };

export type Loadout = { name: string; equipped: EquippedCosmetics };

export type HandViewport = { name: string; width: number; height: number; sheetHeight: number };

export class GalleryPlan {
  static readonly DISTANCES = [2, 8];
  static readonly HAND_VIEWPORTS: HandViewport[] = [
    { name: "16x9", width: 1280, height: 720, sheetHeight: 170 },
    { name: "4x3", width: 1024, height: 768, sheetHeight: 220 },
    { name: "narrow", width: 390, height: 844, sheetHeight: 360 },
  ];

  static readonly TITLE = "title_veteran";

  static readonly BODY_FOCUS = 0.95;
  static readonly TAG_FOCUS = 1.45;

  constructor(private readonly catalog: CatalogItem[]) {}

  category(category: string): CatalogItem[] {
    return this.catalog.filter((it) => it.category === category && !!it.assetRef);
  }

  hats(): CatalogItem[] {
    return this.category("hat");
  }

  isModel(item: CatalogItem): boolean {
    return item.assetRef.startsWith("models/");
  }

  remoteShots(distance: number, focus: number = GalleryPlan.BODY_FOCUS): CameraShot[] {
    const k = Math.SQRT1_2 * distance;
    const target: Vec3 = [0, focus, 0];
    const crop = distance > 4;
    const at = (name: string, x: number, z: number): CameraShot => ({
      name: `${name}_${distance}m`, position: [x, focus + 0.3, z], target, crop,
    });
    return [
      at("front", 0, -distance),
      at("side", distance, 0),
      at("back", 0, distance),
      at("front34", -k, -k),
      at("back34", k, k),
    ];
  }

  corpseShots(): CameraShot[] {
    const target: Vec3 = [0.15, 0.3, 0];
    const at = (name: string, position: Vec3): CameraShot => ({ name, position, target, crop: false });
    return [
      at("sideZpos", [0, 0.9, 1.8]),
      at("sideZneg", [0, 0.9, -1.8]),
      at("headEnd", [1.8, 0.9, 0]),
      at("top", [0.4, 2.0, 0.9]),
    ];
  }

  comboLoadouts(): Loadout[] {
    const backpacks = this.category("backpack");
    const masks = this.category("mask");
    const hats = this.hats();
    const hatPool = [...hats.filter((h) => this.isModel(h)), ...hats.filter((h) => !this.isModel(h))];
    const count = Math.max(backpacks.length, masks.length);
    const out: Loadout[] = [];
    for (let i = 0; i < count; i++) {
      const backpack = backpacks[i % backpacks.length];
      const mask = masks[i % masks.length];
      const hat = hatPool[i % hatPool.length];
      out.push({
        name: `combo${i + 1}_${hat.id}_${mask.id}_${backpack.id}`,
        equipped: { hat: hat.id, mask: mask.id, backpack: backpack.id },
      });
    }
    return out;
  }
}
