import { mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export class GalleryEnvironment {
  static readonly SEED = 424242;
  static readonly MAP_SIZE = 120;
  static readonly WARMUP_FRAMES = 60;
  static readonly SAMPLE_FRAMES = 240;

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

  screenshotPath(name: string): string {
    return join(this.outDir, `${name}.png`);
  }

  jsonPath(name: string): string {
    return join(this.outDir, `${name}.json`);
  }

  sizesPath(): string {
    return join(this.outDir, "sizes.txt");
  }
}
