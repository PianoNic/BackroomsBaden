import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { Scene } from "@babylonjs/core/scene";
import type { CatalogItem } from "../net/protocol";
import { setActiveScene } from "../rendering/babylon";
import { ensureCatalog } from "./cosmetics";
import { CosmeticLoadout } from "./cosmeticLoadout";
import { Corpses } from "./corpses";
import { buildHat, disposeHat } from "./remotePlayerMaterials";
import { group } from "../rendering/babylon";

class SceneCounts {
  constructor(private readonly scene: Scene) {}

  snapshot(): Record<string, number> {
    return {
      meshes: this.scene.meshes.length,
      materials: this.scene.materials.length,
      transformNodes: this.scene.transformNodes.length,
      geometries: this.scene.geometries.length,
    };
  }
}

class HatCatalog {
  static readonly KEYS = [
    "cone", "halo", "gradcap", "crown", "beret", "propeller",
    "viking", "sombrero", "headset", "tophat", "antenna", "wizard",
  ];

  static items(): CatalogItem[] {
    return HatCatalog.KEYS.map((key) => ({
      id: `hat_${key}`, category: "hat", name: key, price: 0, rarity: "common",
      assetRef: key, default: false, attach: null,
    }));
  }
}

describe("procedural hat disposal", () => {
  let engine: NullEngine;
  let scene: Scene;
  let counts: SceneCounts;

  beforeAll(async () => {
    vi.stubGlobal("fetch", async () => ({ ok: true, json: async () => HatCatalog.items() }));
    engine = new NullEngine();
    scene = new Scene(engine);
    setActiveScene(scene);
    counts = new SceneCounts(scene);
    await ensureCatalog();
  });

  afterAll(() => {
    scene.dispose();
    engine.dispose();
    vi.unstubAllGlobals();
  });

  beforeEach(() => {
    setActiveScene(scene);
  });

  it.each(HatCatalog.KEYS)("disposeHat removes every mesh and material of the %s hat", (key) => {
    const before = counts.snapshot();
    const hat = buildHat(key)!;
    expect(counts.snapshot().meshes).toBeGreaterThan(before.meshes);
    disposeHat(hat);
    expect(counts.snapshot()).toEqual(before);
  });

  it("leaves nothing behind after many hat swaps in a loadout", () => {
    const parent = group("owner");
    const loadout = new CosmeticLoadout(parent);
    const before = counts.snapshot();
    for (let i = 0; i < 24; i++) {
      loadout.set({ hat: `hat_${HatCatalog.KEYS[i % HatCatalog.KEYS.length]}` });
    }
    loadout.set({});
    expect(counts.snapshot()).toEqual(before);
    loadout.dispose();
    parent.dispose();
  });

  it("leaves nothing behind when a corpse with a hat is removed", () => {
    const corpses = new Corpses();
    const before = counts.snapshot();
    for (const key of HatCatalog.KEYS) {
      corpses.add("c", 1, 1, "#aabbcc", { hat: `hat_${key}` });
      corpses.remove("c");
    }
    expect(counts.snapshot()).toEqual(before);
  });
});
