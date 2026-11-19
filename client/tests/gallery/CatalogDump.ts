import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { CatalogItem } from "../../src/net/protocol";

export class CatalogDump {
  private readonly here = dirname(fileURLToPath(import.meta.url));
  private readonly serverDir = resolve(this.here, "..", "..", "..", "server");

  constructor(private readonly python: string = process.env.GALLERY_PYTHON ?? "python") {}

  run(targetFile: string): CatalogItem[] {
    execFileSync(this.python, [join(this.here, "dumpCatalog.py"), targetFile], {
      cwd: this.serverDir,
      env: { ...process.env, PYTHONPATH: this.serverDir },
      stdio: "inherit",
    });
    return JSON.parse(readFileSync(targetFile, "utf-8")) as CatalogItem[];
  }
}
