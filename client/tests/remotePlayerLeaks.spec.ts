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
