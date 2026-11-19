import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { BrowserContext, Page } from "@playwright/test";
import type { CatalogItem } from "../../src/net/protocol";
import { CatalogDump } from "./CatalogDump";

export class GallerySession {
  readonly outDir = join(
    process.env.GALLERY_OUT ?? join(tmpdir(), "nachsitzen-gallery"),
    process.env.GALLERY_ROUND ?? "round",
  );
  private readonly errors: string[] = [];
  private sheetPage: Page | null = null;

  constructor(
    private readonly context: BrowserContext,
    readonly page: Page,
  ) {}

  async open(): Promise<CatalogItem[]> {
    mkdirSync(this.outDir, { recursive: true });
    const catalog = new CatalogDump().run(join(this.outDir, "catalog.json"));
    await this.page.route("**/shop/catalog", (route) => route.fulfill({ json: catalog }));
    this.page.on("pageerror", (err) => this.errors.push(err.message));
    this.page.on("console", (msg) => {
      if (msg.type() === "error" || msg.type() === "warning") this.errors.push(msg.text());
    });
    await this.page.setViewportSize({ width: 1280, height: 720 });
    await this.page.goto("/tests/gallery/index.html");
    await this.page.evaluate(() => (window as unknown as { cosmeticGallery: { ready: Promise<void> } })
      .cosmeticGallery.ready);
    this.sheetPage = await this.context.newPage();
    return catalog;
  }

  sheets(): Page {
    if (!this.sheetPage) throw new Error("gallery session is not open");
    return this.sheetPage;
  }

  async close(): Promise<void> {
    await this.sheetPage?.close();
    if (this.errors.length) console.log(this.errors.join("\n"));
  }
}
