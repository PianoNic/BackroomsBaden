import { defineConfig, devices } from "@playwright/test";

const PORT = process.env.GALLERY_PORT ?? "8030";
const BACKEND_PORT = (process.env.GALLERY_BACKEND_PORT ??= String(Number(PORT) + 1));

export default defineConfig({
  testDir: "./tests/gallery",
  testMatch: "**/*.gallery.ts",
  fullyParallel: false,
  retries: 0,
  workers: 1,
  timeout: 600_000,
  reporter: "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    headless: true,
    deviceScaleFactor: 1,
    trace: "off",
  },
  projects: [
    {
      name: "gallery",
      testIgnore: /retroPerf\.gallery\.ts/,
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 720 } },
    },
    {
      name: "perf",
      testMatch: /retroPerf\.gallery\.ts/,
      timeout: 1_800_000,
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 720 },
        launchOptions: { args: ["--disable-frame-rate-limit", "--disable-gpu-vsync"] },
      },
    },
  ],
  webServer: {
    command: `bunx vite --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/tests/gallery/index.html`,
    reuseExistingServer: false,
    timeout: 180_000,
    env: { VITE_DEV_BACKEND: `http://localhost:${BACKEND_PORT}` },
  },
});
