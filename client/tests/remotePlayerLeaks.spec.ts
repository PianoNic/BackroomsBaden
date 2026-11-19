import type { Page } from "@playwright/test";
import type { CatalogItem, EquippedCosmetics } from "../src/net/protocol";
import type { GalleryApi } from "./gallery/GalleryApp";
import type { SceneCounts } from "./gallery/LeakProbe";
import { expect, test } from "./pointerLockStub";

class LeakCatalog {
  static readonly ITEMS: CatalogItem[] = [
    LeakCatalog.item("hat_wizard", "hat", "wizard"),
    LeakCatalog.item("hat_party", "hat", "cone"),
    LeakCatalog.item("hat_fischer", "hat", "models/cosmetics/hat_fischer"),
    LeakCatalog.item("mask_schutzbrille", "mask", "models/cosmetics/mask_schutzbrille"),
    LeakCatalog.item("mask_papiertuete", "mask", "models/cosmetics/mask_papiertuete"),
    LeakCatalog.item("backpack_rucksack", "backpack", "models/cosmetics/backpack_rucksack"),
    LeakCatalog.item("backpack_koffer", "backpack", "models/cosmetics/backpack_koffer"),
    LeakCatalog.item("title_veteran", "title", "Backrooms Veteran|#c9a227"),
  ];

  private static item(id: string, category: CatalogItem["category"], assetRef: string): CatalogItem {
    return { id, category, name: id, price: 0, rarity: "common", assetRef, default: false, attach: null };
  }
}

class LeakScene {
  constructor(private readonly page: Page) {}

  async open(): Promise<void> {
    await this.page.route("**/shop/catalog", (route) => route.fulfill({ json: LeakCatalog.ITEMS }));
    await this.page.goto("/tests/gallery/index.html");
    await this.page.evaluate(() => (window as unknown as { cosmeticGallery: GalleryApi })
      .cosmeticGallery.ready);
  }

  warm(loadouts: EquippedCosmetics[]): Promise<void> {
    return this.page.evaluate((l) => (window as unknown as { cosmeticGallery: GalleryApi })
      .cosmeticGallery.probe.warm(l), loadouts);
  }

  async settle(): Promise<void> {
    await this.page.evaluate(() => (window as unknown as { cosmeticGallery: GalleryApi })
      .cosmeticGallery.probe.settle(6));
  }

  counts(): Promise<SceneCounts> {
    return this.page.evaluate(() => (window as unknown as { cosmeticGallery: GalleryApi })
      .cosmeticGallery.probe.counts());
  }

  join(id: string, equipped: EquippedCosmetics, avatar = false): Promise<void> {
    return this.page.evaluate(([i, e, a]) => (window as unknown as { cosmeticGallery: GalleryApi })
      .cosmeticGallery.probe.join(i as string, e as EquippedCosmetics, a as boolean),
    [id, equipped, avatar] as const);
  }

  equip(id: string, equipped: EquippedCosmetics): Promise<void> {
    return this.page.evaluate(([i, e]) => (window as unknown as { cosmeticGallery: GalleryApi })
      .cosmeticGallery.probe.equip(i as string, e as EquippedCosmetics), [id, equipped] as const);
  }

  camera(id: string, on: boolean): Promise<void> {
    return this.page.evaluate(([i, o]) => (window as unknown as { cosmeticGallery: GalleryApi })
      .cosmeticGallery.probe.camera(i as string, o as boolean), [id, on] as const);
  }

  leave(id: string): Promise<void> {
    return this.page.evaluate((i) => (window as unknown as { cosmeticGallery: GalleryApi })
      .cosmeticGallery.probe.leave(i), id);
  }
}

test("a player who leaves takes the body, tag and cosmetics with them", async ({ page }) => {
  const scene = new LeakScene(page);
  await scene.open();
  const look: EquippedCosmetics = {
    hat: "hat_fischer", mask: "mask_schutzbrille", backpack: "backpack_rucksack", title: "title_veteran",
  };
  await scene.warm([look]);
  await scene.settle();
  const before = await scene.counts();
  await scene.join("leaver", look, true);
  await scene.camera("leaver", true);
  await scene.settle();
  const during = await scene.counts();
  expect(during.meshes).toBeGreaterThan(before.meshes);
  await scene.camera("leaver", false);
  await scene.leave("leaver");
  await scene.settle();
  expect(await scene.counts()).toEqual(before);
});

class LeakLooks {
  static readonly START: EquippedCosmetics = {
    hat: "hat_fischer", mask: "mask_schutzbrille", backpack: "backpack_rucksack", title: "title_veteran",
  };

  static readonly SWAPS: EquippedCosmetics[] = [
    { hat: "hat_wizard", mask: "mask_papiertuete", backpack: "backpack_koffer", title: "title_veteran" },
    { hat: "hat_party", backpack: "backpack_rucksack" },
    { hat: "hat_fischer", mask: "mask_schutzbrille", backpack: "backpack_koffer" },
    { hat: "hat_wizard", mask: "mask_papiertuete" },
    {},
    { hat: "hat_party", mask: "mask_schutzbrille", backpack: "backpack_koffer", title: "title_veteran" },
  ];

  static all(): EquippedCosmetics[] {
    return [LeakLooks.START, ...LeakLooks.SWAPS];
  }
}

test("join, equip, swap and leave cycles leak no meshes, materials or textures", async ({ page }) => {
  const scene = new LeakScene(page);
  await scene.open();
  await scene.warm(LeakLooks.all());
  await scene.settle();
  const baseline = await scene.counts();

  for (const id of ["a", "b"]) {
    await scene.join(id, LeakLooks.START, id === "a");
    await scene.camera(id, id === "b");
  }
  await scene.settle();
  const joined = await scene.counts();
  expect(joined.meshes).toBeGreaterThan(baseline.meshes);
  expect(joined.materials).toBeGreaterThan(baseline.materials);
  expect(joined.textures).toBeGreaterThan(baseline.textures);

  for (let round = 0; round < 4; round++) {
    for (const look of LeakLooks.SWAPS) {
      await scene.equip("a", look);
      await scene.equip("b", look);
      await scene.settle();
    }
    await scene.equip("a", LeakLooks.START);
    await scene.equip("b", LeakLooks.START);
    await scene.settle();
    expect(await scene.counts()).toEqual(joined);
  }

  await scene.camera("b", false);
  await scene.leave("a");
  await scene.leave("b");
  await scene.settle();
  expect(await scene.counts()).toEqual(baseline);
});
