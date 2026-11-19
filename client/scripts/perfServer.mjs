import { spawn, spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

class PerfServer {
  constructor() {
    this.clientRoot = resolve(fileURLToPath(import.meta.url), "..", "..");
    this.serverRoot = resolve(this.clientRoot, "..", "server");
    this.buildDir = process.env.PERF_BUILD_DIR ?? join(tmpdir(), "nachsitzen-perf-build");
    this.port = process.env.PERF_PORT ?? "8020";
    this.python = process.env.PERF_PYTHON ?? "python";
  }

  build() {
    const result = spawnSync(
      "bun",
      ["x", "vite", "build", "--outDir", this.buildDir, "--emptyOutDir"],
      {
        cwd: this.clientRoot,
        stdio: "inherit",
        shell: true,
        env: { ...process.env, VITE_DEV_HOOKS: "1" },
      },
    );
    if (result.status !== 0) process.exit(result.status ?? 1);
  }

  serve() {
    const child = spawn(this.python, ["-m", "app.asgi"], {
      cwd: this.serverRoot,
      stdio: "inherit",
      env: { ...process.env, STATIC_DIR: this.buildDir, NACHSITZEN_PORT: this.port },
    });
    const stop = () => child.kill();
    process.on("SIGTERM", stop);
    process.on("SIGINT", stop);
    child.on("exit", (code) => process.exit(code ?? 0));
  }
}

const server = new PerfServer();
if (process.env.PERF_REUSE_BUILD !== "1") server.build();
server.serve();
