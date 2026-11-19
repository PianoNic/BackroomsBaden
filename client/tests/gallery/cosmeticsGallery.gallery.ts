import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { test } from "../pointerLockStub";
import { CatalogDump } from "./CatalogDump";
import { GalleryCapture } from "./GalleryCapture";
import { GalleryPlan } from "./GalleryPlan";

class GalleryEnvironment {
  readonly outDir = join(
    process.env.GALLERY_OUT ?? join(tmpdir(), "nachsitzen-gallery"),
    process.env.GALLERY_ROUND ?? "round",
  );

  prepare(): void {
    mkdirSync(this.outDir, { recursive: true });
  }

  catalogFile(): string {
    return join(this.outDir, "catalog.json");
  }
}

test("cosmetics pose gallery", async ({ context, page }) => {
  const env = new GalleryEnvironment();
  env.prepare();
  const catalog = new CatalogDump().run(env.catalogFile());
  await page.route("**/shop/catalog", (route) => route.fulfill({ json: catalog }));
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(err.message));
  page.on("console", (msg) => {
    if (msg.type() === "error" || msg.type() === "warning") errors.push(msg.text());
  });
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/tests/gallery/index.html");
  await page.evaluate(() => (window as unknown as { cosmeticGallery: { ready: Promise<void> } })
    .cosmeticGallery.ready);
  const sheetPage = await context.newPage();
  const capture = new GalleryCapture(page, sheetPage, new GalleryPlan(catalog), env.outDir);
  await capture.remote();
  await capture.corpses();
  await capture.hands();
  await sheetPage.close();
  if (errors.length) console.log(errors.join("\n"));
});
