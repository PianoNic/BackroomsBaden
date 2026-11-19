import { defineConfig, devices } from "@playwright/test";

const PORT = "8030";

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
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 720 } } }],
  webServer: {
    command: `bunx vite --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/tests/gallery/index.html`,
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
