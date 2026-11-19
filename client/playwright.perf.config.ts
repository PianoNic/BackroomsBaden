import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/perf",
  testMatch: "**/*.perf.ts",
  fullyParallel: false,
  retries: 0,
  workers: 1,
  timeout: 1_800_000,
  reporter: "list",
  use: {
    baseURL: "http://localhost:8020",
    headless: true,
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 1,
    trace: "off",
    launchOptions: { args: ["--disable-frame-rate-limit", "--disable-gpu-vsync"] },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 720 } } }],
  webServer: {
    command: "node scripts/perfServer.mjs",
    url: "http://localhost:8020/healthz",
    reuseExistingServer: false,
    timeout: 900_000,
    stdout: "pipe",
    stderr: "pipe",
  },
});
