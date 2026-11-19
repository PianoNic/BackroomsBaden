import { type Page } from "@playwright/test";
import { test, expect, PointerLockStub } from "./pointerLockStub";

const PNG_BUFFER = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

function attachErrorCollector(page: Page, label: string, errors: string[]): void {
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`${label}: ${message.text()}`);
  });
  page.on("pageerror", (error) => {
    errors.push(`${label}: ${error.message}`);
  });
}

async function primeSession(page: Page, name: string, cameraOff: boolean): Promise<void> {
  await page.addInitScript((args) => {
    sessionStorage.setItem("nachsitzen-intro-seen", "1");
    localStorage.setItem("nachsitzen_name", args.storedName);
    if (args.cameraOff) localStorage.setItem("nachsitzen_settings", JSON.stringify({ cameraMode: "off" }));
  }, { storedName: name, cameraOff });
}

async function waitForCanvas(page: Page, timeout: number): Promise<void> {
  await page.waitForFunction(() => !!document.querySelector("#app canvas"), null, { timeout });
}

async function waitForTeacherSlotsGone(page: Page): Promise<void> {
  await Promise.any([
    page.locator("#teacher-slots").waitFor({ state: "attached", timeout: 60_000 }),
    page.locator("#taskboard").waitFor({ state: "attached", timeout: 60_000 }),
  ]);
  await page.locator("#teacher-slots").waitFor({ state: "detached", timeout: 90_000 });
}

async function expectHudReady(page: Page): Promise<void> {
  await expect(page.locator("#taskboard")).toBeAttached();
  await expect(page.locator("#task-counter")).toBeAttached();
  await expect(page.locator("#stamina")).toBeAttached();
  await expect(page.locator("#inventory")).toBeAttached();
}

async function releasePointerLockAndOpenPause(page: Page): Promise<void> {
  await page.locator("#app canvas").click();
  await page.evaluate(() => document.exitPointerLock());
  await expect(page.locator("#pause-overlay")).toBeVisible({ timeout: 15_000 });
}

async function leaveToTitle(page: Page): Promise<void> {
  await releasePointerLockAndOpenPause(page);
  await page.locator("#pause-overlay").getByRole("button", { name: "LEAVE" }).click();
  await expect(page.locator("nav.menu").getByRole("button", { name: "PLAY" })).toBeVisible({ timeout: 30_000 });
}

test("live end-to-end flow against a real server", async ({ browser }) => {
  test.setTimeout(1_800_000);
  test.skip(!process.env.LIVE_BASE_URL, "needs a real backend; set LIVE_BASE_URL");

  const errors: string[] = [];
  const started = Date.now();
  const mark = (label: string): void => {
    console.log(`[live] ${label} @${((Date.now() - started) / 1000).toFixed(1)}s`);
  };

  const hostContext = await browser.newContext({ permissions: ["microphone", "camera"] });
  const guestContext = await browser.newContext({ permissions: ["microphone", "camera"] });
  await PointerLockStub.install(hostContext);
  await PointerLockStub.install(guestContext);

  try {
    const host = await hostContext.newPage();
    const guest = await guestContext.newPage();

    attachErrorCollector(host, "host", errors);
    attachErrorCollector(guest, "guest", errors);

    await primeSession(host, "qa-host", false);
    await primeSession(guest, "qa-guest", true);

    await host.goto("/");

    await host.locator(".info-link").click();
    await expect(host.locator("#info-overlay")).toBeVisible();
    await host.getByRole("button", { name: "SCHLIESSEN", exact: true }).click();
    await expect(host.locator("#info-overlay")).not.toBeAttached();

    await host.locator("nav.menu").getByRole("button", { name: "NEWS" }).click();
    await expect(host.locator(".news-panel")).toBeVisible();
    await expect(host.locator("#news-tab-announcements")).toBeVisible();
    await expect(host.locator("#news-tab-changelog")).toBeVisible();
    await host.locator("#news-tab-changelog").click();
    await expect(host.locator("#news-panel-changelog")).toBeVisible();
    await host.locator(".screen-back").click();

    await host.locator("nav.menu").getByRole("button", { name: "SHOP" }).click();
    await expect(host.locator(".bb-cardgrid")).toBeVisible({ timeout: 15_000 });
    await expect(host.locator(".shop-card")).not.toHaveCount(0);
    await host.getByRole("tab", { name: "Titles", exact: true }).click();
    await expect(host.locator(".shop-card")).not.toHaveCount(0);
    await host.locator(".screen-back").click();

    await host.locator("nav.menu").getByRole("button", { name: "OPTIONS" }).click();
    await expect(host.locator(".options-nav")).toBeVisible();
    const fovInput = host.locator("input.bb-range").first();
    await fovInput.fill("95");
    await expect
      .poll(async () => {
        const raw = await host.evaluate(() => localStorage.getItem("nachsitzen_settings"));
        return raw ? (JSON.parse(raw) as { fov: number }).fov : null;
      })
      .toBe(95);
    mark("menu pass");

    await host.locator("#pack-editor-open").click();
    await expect(host.locator("#pack-editor")).toBeVisible({ timeout: 30_000 });
    await host.locator("#pack-consent-check").check();
    await host.locator("#pack-consent-accept").click();
    await host.locator("#pack-editor-id").fill("qa-pack");
    await host.locator("#pack-editor-name").fill("QA Pack");
    await host.setInputFiles("#pack-slot-file-0", {
      name: "portrait.png",
      mimeType: "image/png",
      buffer: PNG_BUFFER,
    });
    await expect(host.locator("#pack-slot-0")).toHaveAttribute("data-ready", "true", { timeout: 15_000 });
    await host.locator("#pack-editor-install").click();
    await expect(host.locator("#pack-editor-status")).toContainText("installiert");
    await host.locator("#pack-editor-close").click();

    await expect(host.locator("#pack-list")).toContainText("QA Pack");
    const useButton = host.locator("#pack-list .bb-seg-btn").first();
    await expect(useButton).toHaveText("USE");
    await useButton.click();
    await expect(useButton).toHaveText("ACTIVE");
    await expect
      .poll(() => host.evaluate(() => localStorage.getItem("nachsitzen_active_pack")))
      .toBe("qa-pack");
    await host.locator("#pack-list .pack-delete").click();
    await expect(host.locator("#pack-list")).toContainText("no packs installed");
    await host.locator(".screen-back").click();
    mark("pack install/use/delete");

    await host.locator("nav.menu").getByRole("button", { name: "TUTORIAL" }).click();
    await expect(host.locator(".tut-item canvas")).toHaveCount(12);
    await host.locator(".screen-back").click();
    mark("tutorial");

    await host.locator("nav.menu").getByRole("button", { name: "PLAY" }).click();
    await host.locator(".create-lobby").click();
    const createLobbyNameInput = host.locator("#create-lobby-name");
    await expect(createLobbyNameInput).toBeFocused();
    const lobbyName = `qa-live-${Date.now().toString(36)}`;
    await createLobbyNameInput.pressSequentially(lobbyName);
    await expect(createLobbyNameInput).toHaveValue(lobbyName);
    await host.locator("#create-modal .bb-btn.primary").click();

    await expect(host.locator("#lobby-room")).toBeVisible({ timeout: 30_000 });
    await expect(host.locator(".players-list")).toContainText("qa-host");
    const hostChatInput = host.locator("form.chat-form input");
    await hostChatInput.fill("hello from host");
    await hostChatInput.press("Enter");
    await expect(host.locator(".chat-log")).toContainText("hello from host");
    mark("lobby created");

    await host.locator("#lobby-room").getByRole("button", { name: "SETTINGS", exact: true }).click();
    await expect(host.locator("#lobby-admin-overlay")).toBeVisible();
    const smallButton = host.locator("#lobby-admin-overlay").getByRole("button", { name: "SMALL", exact: true });
    await smallButton.click();
    await expect(smallButton).toHaveAttribute("aria-pressed", "true");
    await host.locator("#lobby-admin-overlay").getByRole("button", { name: "CLOSE", exact: true }).click();
    await expect(host.locator("#lobby-admin-overlay")).not.toBeAttached();

    await host.locator("#lobby-room").getByRole("button", { name: "SHOP", exact: true }).click();
    await expect(host.locator("#shop-overlay")).toBeVisible();
    await expect(host.locator(".shop-card")).not.toHaveCount(0);
    await host.locator("#shop-overlay").getByRole("button", { name: "← CLOSE", exact: true }).click();
    await expect(host.locator("#shop-overlay")).not.toBeAttached();

    await guest.goto("/");
    await guest.locator("nav.menu").getByRole("button", { name: "PLAY" }).click();
    const lobbyRow = guest.locator(".lobby-row", { hasText: lobbyName });
    await expect(async () => {
      await guest.locator(".icon-btn").click();
      await expect(lobbyRow).toBeVisible({ timeout: 2_000 });
    }).toPass({ timeout: 20_000 });
    await lobbyRow.click();

    await expect(guest.locator("#lobby-room")).toBeVisible({ timeout: 30_000 });
    await expect(host.locator(".players-list")).toContainText("qa-guest", { timeout: 20_000 });
    await expect(host.locator(".count")).toHaveText("2/8", { timeout: 20_000 });
    const guestChatInput = guest.locator("form.chat-form input");
    await guestChatInput.fill("hello from guest");
    await guestChatInput.press("Enter");
    await expect(host.locator(".chat-log")).toContainText("hello from guest", { timeout: 20_000 });
    mark("guest joined");

    await host.locator(".start-btn").click();
    await Promise.all([waitForCanvas(host, 180_000), waitForCanvas(guest, 180_000)]);
    mark("round 1 world ready");

    await Promise.all([waitForTeacherSlotsGone(host), waitForTeacherSlotsGone(guest)]);
    await expectHudReady(host);
    await expectHudReady(guest);

    await releasePointerLockAndOpenPause(host);
    const pauseOverlay = host.locator("#pause-overlay");
    await expect(pauseOverlay.getByRole("button", { name: "RESUME" })).toBeVisible();
    await expect(pauseOverlay.getByRole("button", { name: "OPTIONS" })).toBeVisible();
    await expect(pauseOverlay.getByRole("button", { name: "LEAVE" })).toBeVisible();
    await pauseOverlay.getByRole("button", { name: "OPTIONS" }).click();
    await expect(host.locator("#settings-overlay")).toBeVisible();
    await expect(host.locator("#pause-overlay")).not.toBeAttached();
    await host.locator("#settings-overlay .bb-btn.back").click();
    await expect(host.locator("#pause-overlay")).toBeVisible();
    const micButton = pauseOverlay.locator("button", { hasText: /^MIC/ });
    const micLabelBefore = await micButton.textContent();
    await micButton.click();
    await expect(micButton).not.toHaveText(micLabelBefore ?? "", { timeout: 15_000 });
    const camButton = pauseOverlay.locator("button", { hasText: /^CAM/ });
    const camLabelBefore = await camButton.textContent();
    await camButton.click();
    await expect(camButton).not.toHaveText(camLabelBefore ?? "", { timeout: 15_000 });
    await pauseOverlay.getByRole("button", { name: "RESUME" }).click();
    await expect(host.locator("#pause-overlay")).not.toBeAttached();
    mark("pause menu done");

    await Promise.all([
      expect(host.locator("#victory")).toBeVisible({ timeout: 420_000 }),
      expect(guest.locator("#victory")).toBeVisible({ timeout: 420_000 }),
    ]);
    await expect(host.locator("#victory")).toHaveClass(/lost/);
    await expect(host.locator("#victory")).toContainText("CAUGHT");
    mark("endgame shown");

    await host.locator("#back-to-lobby-btn").click();
    await Promise.all([
      expect(host.locator("#lobby-room")).toBeVisible({ timeout: 30_000 }),
      expect(guest.locator("#lobby-room")).toBeVisible({ timeout: 30_000 }),
    ]);
    await expect(host.locator(".count")).toHaveText("2/8", { timeout: 20_000 });
    await expect(guest.locator(".count")).toHaveText("2/8", { timeout: 20_000 });
    mark("both back in lobby");

    const starter = await Promise.any([
      expect(host.locator(".start-btn")).toBeEnabled({ timeout: 20_000 }).then(() => host),
      expect(guest.locator(".start-btn")).toBeEnabled({ timeout: 20_000 }).then(() => guest),
    ]);
    await starter.locator(".start-btn").click();
    await Promise.all([waitForCanvas(host, 180_000), waitForCanvas(guest, 180_000)]);
    mark("round 2 world ready");

    await Promise.all([leaveToTitle(guest), leaveToTitle(host)]);
    mark("back on title");
  } finally {
    await guestContext.close();
    await hostContext.close();
  }

  expect(errors).toEqual([]);
});
