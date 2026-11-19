import { type Page } from "@playwright/test";
import { test, expect } from "./pointerLockStub";
import { mockBackend } from "./backendMocks";

const ATTACH = { x: 0, y: 0, z: 0.3, scale: 1, yaw: 0, pitch: 0 };

const CATALOG = [
  { id: "body_default", category: "body", name: "Standard Issue", price: 0, rarity: "common", assetRef: "", default: true, attach: null, featured: false, unlock: null },
  { id: "backpack_none", category: "backpack", name: "Ohne Rucksack", price: 0, rarity: "common", assetRef: "", default: true, attach: null, featured: false, unlock: null },
  { id: "backpack_schul", category: "backpack", name: "Schulrucksack", price: 200, rarity: "common", assetRef: "models/cosmetics/backpack_rucksack", default: false, attach: ATTACH, featured: true, unlock: null },
  { id: "mask_none", category: "mask", name: "Ohne Maske", price: 0, rarity: "common", assetRef: "", default: true, attach: null, featured: false, unlock: null },
  { id: "mask_rennbrille", category: "mask", name: "Rennbrille", price: 0, rarity: "rare", assetRef: "models/cosmetics/mask_rennbrille", default: false, attach: ATTACH, featured: false, unlock: "ach_speedrun" },
  { id: "handitem_lupe", category: "handitem", name: "Lupe", price: 400, rarity: "rare", assetRef: "models/cosmetics/handitem_lupe", default: false, attach: ATTACH, featured: false, unlock: null },
];

async function openShop(page: Page): Promise<void> {
  await page.addInitScript(() => sessionStorage.setItem("nachsitzen-intro-seen", "1"));
  await mockBackend(page);
  await page.route("**/shop/catalog", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(CATALOG) }),
  );
  await page.route("**/shop/me", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ signedIn: true, balance: 500, owned: ["body_default", "backpack_none", "mask_none"], equipped: {} }),
    }),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "SHOP" }).click();
}

test("the shop shows tabs for the model cosmetic categories", async ({ page }) => {
  await openShop(page);

  for (const name of ["Backpacks", "Masks", "Hand items"]) {
    await expect(page.getByRole("tab", { name })).toBeVisible();
  }
});

test("the daily featured strip lists the featured items with a buy button", async ({ page }) => {
  await openShop(page);

  const strip = page.locator(".shop-featured");
  await expect(strip).toBeVisible();
  await expect(strip.getByText("Schulrucksack")).toBeVisible();
  await expect(strip.getByRole("button", { name: /BUY · 200/ })).toBeEnabled();
  await expect(strip.getByText("Lupe")).toHaveCount(0);
});

test("an achievement-locked item shows its achievement and no buy button", async ({ page }) => {
  await openShop(page);

  await page.getByRole("tab", { name: "Masks" }).click();
  const card = page.locator(".shop-card", { hasText: "Rennbrille" });
  await expect(card).toBeVisible();
  await expect(card.getByText("Unlocked by achievement Speedrunner")).toBeVisible();
  await expect(card.getByRole("button")).toHaveCount(0);

  await page.getByRole("tab", { name: "Hand items" }).click();
  const lupe = page.locator(".shop-card", { hasText: "Lupe" });
  await expect(lupe.getByRole("button", { name: /BUY · 400/ })).toBeVisible();
});
