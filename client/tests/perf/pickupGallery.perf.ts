import { writeFileSync } from "node:fs";
import { test } from "@playwright/test";
import type { PickupKind } from "../../src/net/protocol";
import type { DevHandle } from "../../src/core/devTools";
import { FrameProbe } from "./FrameProbe";
import { GameSession } from "./GameSession";
import { PerfEnvironment } from "./PerfEnvironment";
import { ViewpointPlanner } from "./ViewpointPlanner";

type DevWindow = { nachsitzenDev: DevHandle };
type Found = { x: number; z: number };

class PickupGallery {
  readonly report: Record<string, unknown> = {};

  constructor(
    private readonly env: PerfEnvironment,
    private readonly session: GameSession,
    private readonly planner: ViewpointPlanner,
    private readonly probe: FrameProbe,
  ) {}

  async locate(): Promise<Map<PickupKind, Found>> {
    const wanted = new Set<PickupKind>(ViewpointPlanner.pickupKinds());
    const found = new Map<PickupKind, Found>();
    for (const locker of this.planner.lockersBySpawnDistance()) {
      if (found.size === wanted.size) break;
      await this.session.openLocker(locker.id, locker.x, locker.z);
      for (const spawn of await this.session.spawnedPickups()) {
        if (!found.has(spawn.kind)) found.set(spawn.kind, { x: spawn.x, z: spawn.z });
      }
    }
    return found;
  }

  private async meshesNear(at: Found): Promise<unknown> {
    return this.session.page.evaluate(({ x, z }) => {
      const scene = (window as unknown as DevWindow).nachsitzenDev.camera.getScene();
      return scene.meshes
        .filter((m) => {
          const p = m.getAbsolutePosition();
          return Math.hypot(p.x - x, p.z - z) < 0.6 && p.y < 1.2 && m.isEnabled();
        })
        .map((m) => ({
          name: m.name,
          material: m.material ? `${m.material.getClassName()}:${m.material.name}:${m.material.alpha}` : null,
          visible: m.isVisible,
          y: m.getAbsolutePosition().y,
        }));
    }, at);
  }

  private async aim(distance: number, at: Found): Promise<number> {
    return this.session.page.evaluate(({ d, a }) => {
      const dev = (window as unknown as DevWindow).nachsitzenDev;
      const scene = dev.camera.getScene();
      let sum = 0;
      let count = 0;
      for (const m of scene.meshes) {
        if (!m.isEnabled() || !m.isVisible || m.getTotalVertices() === 0) continue;
        const p = m.getAbsolutePosition();
        if (Math.hypot(p.x - a.x, p.z - a.z) > 0.3 || p.y < 0.2 || p.y > 1.0) continue;
        sum += p.y;
        count++;
      }
      const targetY = count > 0 ? sum / count : 0.45;
      dev.player.position.y = 0.8;
      dev.player.pitch = Math.atan2(targetY - 0.8, d);
      return targetY;
    }, { d: distance, a: at });
  }

  async run(): Promise<void> {
    await this.probe.brighten();
    const found = await this.locate();
    await this.session.page.waitForTimeout(1500);
    for (const [kind, at] of found) {
      const view = this.planner.facing(`pickup-${kind}`, at.x, at.z, 0.7, 0.45);
      if (!view) continue;
      await this.probe.place(view, 5);
      const targetY = await this.aim(0.7, at);
      await this.session.page.waitForTimeout(400);
      this.report[kind] = { at, targetY, meshes: await this.meshesNear(at) };
      await this.probe.screenshot(this.env.screenshotPath(`pickup-${kind}`));
    }
  }
}

test("pickup gallery", async ({ browser }) => {
  const env = new PerfEnvironment();
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 1,
  });
  const session = new GameSession(context);
  try {
    const init = await session.start();
    await session.page.waitForTimeout(10_000);
    await session.parkMain(-1000, -1000);
    await session.botSend({ type: "move", x: -1000, z: -1000, yaw: 0 });
    const planner = new ViewpointPlanner(init);
    const probe = new FrameProbe(session.page);
    await probe.calibrate(init.spawn.x, init.spawn.z);
    const gallery = new PickupGallery(env, session, planner, probe);
    await gallery.run();
    writeFileSync(
      env.jsonPath().replace("perf.json", "pickups.json"),
      JSON.stringify(gallery.report, null, 2),
    );
  } finally {
    await session.close();
    await context.close();
  }
});
