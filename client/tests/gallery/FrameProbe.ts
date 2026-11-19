import type { Page } from "@playwright/test";
import type { DevHandle } from "../../src/core/devTools";
import type { Viewpoint } from "./ViewpointPlanner";

export type Stat = { median: number; p95: number; mean: number; max: number };

export type FrameMeasurement = {
  frameMs: Stat;
  drawCalls: Stat;
  activeMeshes: Stat;
  activeTriangles: Stat;
};

export type SceneTotals = {
  renderer: string;
  meshes: number;
  enabledMeshes: number;
  totalVertices: number;
  materials: number;
  textures: number;
  gpuTextures: number;
  gpuTextureBytesEstimate: number;
  lights: number;
};

type DevWindow = { nachsitzenDev: DevHandle };

export class FrameProbe {
  private basis: { f0: [number, number]; f1: [number, number] } | null = null;

  constructor(private readonly page: Page) {}

  async calibrate(x: number, z: number): Promise<void> {
    const read = (yaw: number): Promise<[number, number]> =>
      this.page.evaluate(async ({ px, pz, angle }) => {
        const dev = (window as unknown as DevWindow).nachsitzenDev;
        dev.player.spawn(px, pz, angle);
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        const m = dev.camera.getViewMatrix(true).m;
        return [-m[2], -m[10]] as [number, number];
      }, { px: x, pz: z, angle: yaw });
    const f0 = await read(0);
    const f1 = await read(Math.PI / 2);
    this.basis = { f0, f1 };
  }

  yawToward(dx: number, dz: number): number {
    if (!this.basis) throw new Error("probe not calibrated");
    const { f0, f1 } = this.basis;
    const len = Math.hypot(dx, dz) || 1;
    const nx = dx / len;
    const nz = dz / len;
    return Math.atan2(nx * f1[0] + nz * f1[1], nx * f0[0] + nz * f0[1]);
  }

  async place(view: Viewpoint, settleFrames = 90): Promise<{ yaw: number; pitch: number }> {
    const yaw = view.yaw ?? this.yawToward(view.lookX - view.x, view.lookZ - view.z);
    const flat = Math.hypot(view.lookX - view.x, view.lookZ - view.z);
    const pitch = view.yaw !== undefined ? 0 : Math.atan2(view.lookY - 1.7, flat);
    await this.page.evaluate(async ({ x, z, yawRad, pitchRad, frames }) => {
      const dev = (window as unknown as DevWindow).nachsitzenDev;
      dev.player.spawn(x, z, yawRad);
      dev.player.pitch = pitchRad;
      for (let i = 0; i < frames; i++) await new Promise((r) => requestAnimationFrame(r));
    }, { x: view.x, z: view.z, yawRad: yaw, pitchRad: pitch, frames: settleFrames });
    return { yaw, pitch };
  }

  async screenshot(path: string): Promise<void> {
    await this.page.evaluate(() => {
      for (const child of Array.from(document.body.children) as HTMLElement[]) {
        if (!child.querySelector("canvas") && child.tagName !== "CANVAS") {
          child.dataset.perfHidden = child.style.visibility;
          child.style.visibility = "hidden";
        }
      }
    });
    await this.page.screenshot({ path });
    await this.page.evaluate(() => {
      for (const child of Array.from(document.body.children) as HTMLElement[]) {
        if (child.dataset.perfHidden !== undefined) {
          child.style.visibility = child.dataset.perfHidden;
          delete child.dataset.perfHidden;
        }
      }
    });
  }

  async brighten(): Promise<void> {
    await this.page.evaluate(() => {
      const scene = (window as unknown as DevWindow).nachsitzenDev.camera.getScene();
      const ambient = scene.getLightByName("ambient");
      scene.onBeforeRenderObservable.add(() => {
        if (ambient) ambient.intensity = 4;
        scene.imageProcessingConfiguration.exposure = 2.2;
      });
    });
  }

  async teacherPositions(): Promise<{ x: number; z: number }[]> {
    return this.page.evaluate(
      () => (window as unknown as DevWindow).nachsitzenDev.teacherPositions(),
    );
  }

  async sceneTotals(): Promise<SceneTotals> {
    return this.page.evaluate(() => {
      type Tex = { width: number; height: number; generateMipMaps?: boolean; isCube?: boolean };
      const dev = (window as unknown as DevWindow).nachsitzenDev;
      const scene = dev.camera.getScene();
      const engine = scene.getEngine();
      const cache = (engine as unknown as { getLoadedTexturesCache(): Tex[] }).getLoadedTexturesCache();
      let bytes = 0;
      for (const t of cache) {
        const faces = t.isCube ? 6 : 1;
        bytes += t.width * t.height * 4 * faces * (t.generateMipMaps ? 4 / 3 : 1);
      }
      return {
        renderer: (engine as unknown as { getGlInfo(): { renderer: string } }).getGlInfo().renderer,
        meshes: scene.meshes.length,
        enabledMeshes: scene.meshes.filter((m) => m.isEnabled()).length,
        totalVertices: scene.getTotalVertices(),
        materials: scene.materials.length,
        textures: scene.textures.length,
        gpuTextures: cache.length,
        gpuTextureBytesEstimate: Math.round(bytes),
        lights: scene.lights.length,
      };
    });
  }

  async framesPerSecond(durationMs: number): Promise<number> {
    return this.page.evaluate(async (ms) => {
      let frames = 0;
      const start = performance.now();
      await new Promise<void>((resolve) => {
        const tick = (t: number): void => {
          frames++;
          if (t - start >= ms) resolve();
          else requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
      return (frames * 1000) / (performance.now() - start);
    }, durationMs);
  }

  async measure(warmup: number, samples: number): Promise<FrameMeasurement> {
    return this.page.evaluate(async ({ warm, count }) => {
      const dev = (window as unknown as DevWindow).nachsitzenDev;
      const scene = dev.camera.getScene();
      const engine = scene.getEngine() as unknown as { _drawCalls: { current: number } };
      const draw: number[] = [];
      const meshes: number[] = [];
      const tris: number[] = [];
      let frameIndex = 0;
      let previousTotal = -1;
      const observer = scene.onAfterRenderObservable.add(() => {
        frameIndex++;
        if (frameIndex < warm) return;
        const total = engine._drawCalls.current;
        if (previousTotal >= 0) draw.push(total - previousTotal);
        previousTotal = total;
        meshes.push(scene.getActiveMeshes().length);
        tris.push(scene.getActiveIndices() / 3);
      });
      const times: number[] = [];
      let last = 0;
      let seen = 0;
      await new Promise<void>((resolve) => {
        const tick = (t: number): void => {
          if (last > 0) {
            seen++;
            if (seen > warm) times.push(t - last);
          }
          last = t;
          if (times.length >= count) resolve();
          else requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
      scene.onAfterRenderObservable.remove(observer);
      const stat = (values: number[]): { median: number; p95: number; mean: number; max: number } => {
        const sorted = [...values].sort((a, b) => a - b);
        const at = (q: number): number => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] ?? 0;
        const mean = values.reduce((a, b) => a + b, 0) / Math.max(1, values.length);
        return { median: at(0.5), p95: at(0.95), mean, max: sorted[sorted.length - 1] ?? 0 };
      };
      return {
        frameMs: stat(times),
        drawCalls: stat(draw),
        activeMeshes: stat(meshes),
        activeTriangles: stat(tris),
      };
    }, { warm: warmup, count: samples });
  }
}
