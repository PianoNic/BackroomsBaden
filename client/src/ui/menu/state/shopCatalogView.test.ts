import { describe, it, expect } from "vitest";
import type { CatalogItem } from "../../../net/protocol";
import { ShopCatalogView } from "./shopCatalogView";

function item(id: string, category: CatalogItem["category"], extra: Partial<CatalogItem> = {}): CatalogItem {
  return { id, category, name: id, price: 100, rarity: "common", assetRef: "", default: false, ...extra };
}

const ITEMS: CatalogItem[] = [
  item("hat_a", "hat", { featured: true }),
  item("hat_b", "hat"),
  item("mask_a", "mask", { featured: true }),
  item("mask_locked", "mask", { unlock: "ach_speedrun", price: 0 }),
  item("backpack_none", "backpack", { default: true, price: 0, featured: true }),
];

describe("ShopCatalogView.inCategory", () => {
  it("returns only the items of the category", () => {
    expect(ShopCatalogView.inCategory(ITEMS, "hat").map((i) => i.id)).toEqual(["hat_a", "hat_b"]);
    expect(ShopCatalogView.inCategory(ITEMS, "handitem")).toEqual([]);
  });
});

describe("ShopCatalogView.featured", () => {
  it("keeps featured buyable items only", () => {
    expect(ShopCatalogView.featured(ITEMS).map((i) => i.id)).toEqual(["hat_a", "mask_a"]);
  });
});

describe("ShopCatalogView locking", () => {
  it("locks an unlock item until it is owned", () => {
    const locked = ITEMS[3];
    expect(ShopCatalogView.isLocked(locked, new Set())).toBe(true);
    expect(ShopCatalogView.isLocked(locked, new Set(["mask_locked"]))).toBe(false);
    expect(ShopCatalogView.isLocked(ITEMS[0], new Set())).toBe(false);
  });

  it("names the achievement in the locked label", () => {
    expect(ShopCatalogView.lockedLabel(ITEMS[3])).toBe("Unlocked by achievement Speedrunner");
    expect(ShopCatalogView.lockedLabel(ITEMS[0])).toBe("");
  });

  it("falls back to the raw id for an unknown achievement", () => {
    expect(ShopCatalogView.achievementName("ach_new")).toBe("ach_new");
  });
});
