import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

type Mode = "vite" | "game";

export class GalleryServer {
  static readonly DEFAULT_PORT = "8020";

  private child: ChildProcess | null = null;
  private readonly port = process.env.GALLERY_PORT ?? GalleryServer.DEFAULT_PORT;
  private readonly python = process.env.GALLERY_PYTHON ?? "python";
  private readonly clientRoot = fileURLToPath(new URL("../..", import.meta.url));
  private readonly serverRoot = fileURLToPath(new URL("../../../server", import.meta.url));
  private readonly buildDir = join(
    process.env.GALLERY_BUILD_DIR ?? join(tmpdir(), "nachsitzen-gallery-client"),
    this.port,
  );

  private constructor(private readonly mode: Mode) {}

  static vite(): GalleryServer {
    return new GalleryServer("vite");
  }

  static game(): GalleryServer {
    return new GalleryServer("game");
  }

  async start(): Promise<void> {
    if (this.child) return;
    if (this.mode === "game") this.buildClient();
    this.child = this.mode === "vite" ? this.spawnVite() : this.spawnGame();
    const deadline = Date.now() + 180_000;
    while (Date.now() < deadline) {
      if (await this.healthy()) return;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    this.stop();
    throw new Error(`gallery server did not become healthy on port ${this.port}`);
  }

  stop(): void {
    const pid = this.child?.pid;
    this.child = null;
    if (!pid) return;
    if (process.platform === "win32") spawnSync("taskkill", ["/PID", String(pid), "/T", "/F"]);
    else process.kill(pid);
  }

  private buildClient(): void {
    const result = spawnSync(
      "bunx",
      ["vite", "build", "--outDir", this.buildDir, "--emptyOutDir", "--logLevel", "warn"],
      {
        cwd: this.clientRoot,
        stdio: "inherit",
        shell: process.platform === "win32",
        env: { ...process.env, VITE_DEV_HOOKS: "1" },
      },
    );
    if (result.status !== 0) throw new Error("gallery client build failed");
  }

  private spawnVite(): ChildProcess {
    return spawn("bunx", ["vite", "--port", this.port, "--strictPort"], {
      cwd: this.clientRoot,
      stdio: "ignore",
      shell: process.platform === "win32",
    });
  }

  private spawnGame(): ChildProcess {
    return spawn(this.python, ["-m", "app.asgi"], {
      cwd: this.serverRoot,
      stdio: "ignore",
      env: { ...process.env, NACHSITZEN_PORT: this.port, STATIC_DIR: this.buildDir },
    });
  }

  private async healthy(): Promise<boolean> {
    const path = this.mode === "vite" ? "/tests/gallery/index.html" : "/healthz";
    try {
      return (await fetch(`http://localhost:${this.port}${path}`)).ok;
    } catch {
      return false;
    }
  }
}
