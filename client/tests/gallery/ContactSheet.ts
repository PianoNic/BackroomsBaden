import { readFileSync, writeFileSync } from "node:fs";
import type { Page } from "@playwright/test";

export type SheetRow = { label: string; files: string[] };

export class ContactSheet {
  private static readonly LABEL_WIDTH = 170;

  constructor(
    private readonly page: Page,
    private readonly tileHeight = 180,
    private readonly zoom = 1,
  ) {}

  private tile(file: string): string {
    const data = readFileSync(file).toString("base64");
    const frameWidth = Math.round(this.tileHeight * (16 / 9));
    const shift = (this.zoom - 1) / 2;
    const img = `<img src="data:image/png;base64,${data}" style="position:absolute;height:${this.tileHeight * this.zoom}px;width:auto;left:${-shift * frameWidth}px;top:${-shift * this.tileHeight}px;image-rendering:pixelated">`;
    if (this.zoom === 1) return img.replace("position:absolute;", "").replace("height:", "display:block;height:");
    return `<div style="position:relative;overflow:hidden;width:${frameWidth}px;height:${this.tileHeight}px">${img}</div>`;
  }

  private html(title: string, headers: string[], rows: SheetRow[]): string {
    const legend = headers.join(" | ");
    const body = rows.map((row) => {
      const cells = row.files.map((f) => `<div class="cell">${this.tile(f)}</div>`).join("");
      return `<div class="row"><div class="label">${row.label}</div>${cells}</div>`;
    }).join("");
    return `<!doctype html><html><head><meta charset="utf-8"><style>
      body{margin:0;background:#111;color:#ddd;font:12px monospace}
      .title{padding:6px 8px;font-size:14px}
      .row{display:flex;border-top:1px solid #333}
      .label{width:${ContactSheet.LABEL_WIDTH}px;flex:none;padding:4px 6px;box-sizing:border-box;word-break:break-all}
      .cell{padding:1px;flex:none}
    </style></head><body><div class="title">${title} [${legend}]</div>${body}</body></html>`;
  }

  async write(target: string, title: string, headers: string[], rows: SheetRow[]): Promise<void> {
    if (rows.length === 0) return;
    await this.page.setViewportSize({ width: 400, height: 400 });
    await this.page.setContent(this.html(title, headers, rows));
    writeFileSync(target, await this.page.screenshot({ fullPage: true }));
  }
}
