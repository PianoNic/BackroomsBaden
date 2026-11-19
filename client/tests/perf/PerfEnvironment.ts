import { mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export class PerfEnvironment {
  static readonly SEED = 424242;
  static readonly MAP_SIZE = 120;
  static readonly WARMUP_FRAMES = 60;
  static readonly SAMPLE_FRAMES = 240;

  readonly outDir: string;
  readonly buildDir: string;

  constructor() {
    this.outDir = process.env.PERF_OUT_DIR ?? join(tmpdir(), "nachsitzen-perf-out");
    this.buildDir = process.env.PERF_BUILD_DIR ?? join(tmpdir(), "nachsitzen-perf-build");
    mkdirSync(this.outDir, { recursive: true });
  }

  screenshotPath(name: string): string {
    return join(this.outDir, `${name}.png`);
  }

  jsonPath(): string {
    return join(this.outDir, "perf.json");
  }

  sizesPath(): string {
    return join(this.outDir, "sizes.txt");
  }
}
