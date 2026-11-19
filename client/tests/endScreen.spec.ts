import { test, expect } from "./pointerLockStub";
import { mockBackend } from "./backendMocks";

async function bootMenu(page: import("@playwright/test").Page): Promise<void> {
  await page.addInitScript(() => sessionStorage.setItem("nachsitzen-intro-seen", "1"));
  await mockBackend(page);
  await page.goto("/");
  await page.waitForFunction(() => document.getElementById("menu-root") !== null);
}

test("the end screen closes the pause menu and a laptop overlay that were open", async ({ page }) => {
  await bootMenu(page);

  await page.evaluate(async () => {
    const overlays = await import("/src/ui/menu/state/overlays.ts");
    const laptop = await import("/src/ui/laptop/state.ts");
    const victory = await import("/src/ui/victory.ts");
    overlays.pauseMenu.value = { onResume: () => undefined, onLeave: () => undefined };
    laptop.openLaptop("lap", "coinflip", false);
    victory.showGameOver(null, null, null);
  });

  await expect(page.locator("#victory")).toBeVisible();
  await expect(page.locator("#pause-overlay")).toHaveCount(0);
  await expect(page.locator("#laptop")).toHaveCount(0);
});
