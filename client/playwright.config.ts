import { defineConfig, devices } from "@playwright/test";

const DEV_PORT = process.env.E2E_PORT ?? "5173";
const LIVE_BASE_URL = process.env.LIVE_BASE_URL;

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: "list",
  use: {
    trace: process.env.CI ? "retain-on-failure" : "off",
    screenshot: process.env.CI ? "only-on-failure" : "off",
  },
  projects: [
    {
      name: "chromium",
      testIgnore: /live\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], baseURL: `http://localhost:${DEV_PORT}` },
    },
    {
      name: "live",
      testMatch: /live\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        baseURL: LIVE_BASE_URL ?? `http://localhost:${DEV_PORT}`,
        actionTimeout: 30_000,
        launchOptions: {
          args: [
            "--use-fake-device-for-media-stream",
            "--use-fake-ui-for-media-stream",
            "--autoplay-policy=no-user-gesture-required",
          ],
        },
      },
    },
  ],
  webServer: LIVE_BASE_URL
    ? undefined
    : {
        command: `bun run dev --port ${DEV_PORT} --strictPort`,
        url: `http://localhost:${DEV_PORT}`,
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
      },
});
