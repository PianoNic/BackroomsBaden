import { test, expect } from "./pointerLockStub";
import { mockBackend } from "./backendMocks";

async function bootMenu(page: import("@playwright/test").Page): Promise<void> {
  await page.addInitScript(() => sessionStorage.setItem("nachsitzen-intro-seen", "1"));
  await mockBackend(page);
  await page.goto("/");
  await page.waitForFunction(() => document.getElementById("menu-root") !== null);
}

test("the math popup does not release the pointer lock", async ({ page }) => {
  await bootMenu(page);

  const state = await page.evaluate(async () => {
    const mod = await import("/src/gameplay/teacherEffectHelpers.ts");
    document.body.requestPointerLock();
    await new Promise((resolve) => setTimeout(resolve, 50));
    mod.showMathPopup("Herr Test");
    await new Promise((resolve) => setTimeout(resolve, 100));
    return {
      locked: document.pointerLockElement !== null,
      popupInput: document.querySelectorAll("body > div > input").length,
    };
  });

  expect(state.locked).toBe(true);
  expect(state.popupInput).toBe(1);
});

test("a game-initiated release is consumed once and never looks like a pause", async ({ page }) => {
  await bootMenu(page);

  const result = await page.evaluate(async () => {
    const mod = await import("/src/core/pointerLockGate.ts");
    document.body.requestPointerLock();
    await new Promise((resolve) => setTimeout(resolve, 50));
    mod.PointerLockGate.releaseForGame();
    await new Promise((resolve) => setTimeout(resolve, 50));
    return {
      lockedAfterRelease: document.pointerLockElement !== null,
      first: mod.PointerLockGate.consumeGameRelease(),
      second: mod.PointerLockGate.consumeGameRelease(),
    };
  });

  expect(result.lockedAfterRelease).toBe(false);
  expect(result.first).toBe(true);
  expect(result.second).toBe(false);
});
