import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { fileURLToPath } from "node:url";

export class BackendProcess {
  private child: ChildProcess | null = null;
  private readonly port = process.env.GALLERY_BACKEND_PORT ?? "8031";
  private readonly python = process.env.GALLERY_PYTHON ?? "python";

  async start(): Promise<void> {
    if (this.child) return;
    const serverRoot = fileURLToPath(new URL("../../../server", import.meta.url));
    this.child = spawn(this.python, ["-m", "app.asgi"], {
      cwd: serverRoot,
      stdio: "ignore",
      env: { ...process.env, NACHSITZEN_PORT: this.port },
    });
    const deadline = Date.now() + 120_000;
    while (Date.now() < deadline) {
      if (await this.healthy()) return;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    this.stop();
    throw new Error(`backend did not become healthy on port ${this.port}`);
  }

  stop(): void {
    const pid = this.child?.pid;
    this.child = null;
    if (!pid) return;
    if (process.platform === "win32") spawnSync("taskkill", ["/PID", String(pid), "/T", "/F"]);
    else process.kill(pid);
  }

  private async healthy(): Promise<boolean> {
    try {
      return (await fetch(`http://localhost:${this.port}/healthz`)).ok;
    } catch {
      return false;
    }
  }
}
