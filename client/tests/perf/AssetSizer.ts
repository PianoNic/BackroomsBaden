import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

export type AssetSizes = { publicBytes: number; buildBytes: number };

export class AssetSizer {
  constructor(
    private readonly publicDir: string,
    private readonly buildDir: string,
    private readonly excluded = "sounds",
  ) {}

  measure(): AssetSizes {
    return {
      publicBytes: this.walk(this.publicDir, true),
      buildBytes: this.walk(this.buildDir, true),
    };
  }

  format(sizes: AssetSizes): string {
    const mib = (bytes: number): string => (bytes / (1024 * 1024)).toFixed(2);
    return [
      `client/public excluding ${this.excluded}: ${sizes.publicBytes} bytes (${mib(sizes.publicBytes)} MiB)`,
      `build output excluding ${this.excluded}: ${sizes.buildBytes} bytes (${mib(sizes.buildBytes)} MiB)`,
      "",
    ].join("\n");
  }

  private walk(dir: string, top: boolean): number {
    let total = 0;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (top && entry.isDirectory() && entry.name === this.excluded) continue;
      const path = join(dir, entry.name);
      if (entry.isDirectory()) total += this.walk(path, false);
      else total += statSync(path).size;
    }
    return total;
  }
}
