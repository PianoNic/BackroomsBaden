import type { BrowserContext, Page } from "@playwright/test";
import type { CatalogItem } from "../../src/net/protocol";
import { CatalogDump } from "./CatalogDump";
import { GalleryEnvironment } from "./GalleryEnvironment";

export class GallerySession {
  private readonly env = new GalleryEnvironment();
  private readonly errors: string[] = [];
  private sheetPage: Page | null = null;

  constructor(
    private readonly context: BrowserContext,
    readonly page: Page,
  ) {}

  async open(): Promise<CatalogItem[]> {
    this.env.prepare();
    const catalog = new CatalogDump().run(this.env.catalogFile());
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

  get outDir(): string {
    return this.env.outDir;
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
