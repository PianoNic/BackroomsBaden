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

  async crouchClassroom(): Promise<void> {
    const view = this.planner.roomViews().find((v) => v.name === "room-classroom");
    if (!view) return;
    await this.session.page.keyboard.down("KeyC");
    await this.probe.place({ ...view, name: "crouch-classroom" }, 90);
    await this.probe.screenshot(this.env.screenshotPath("crouch-classroom"));
    await this.session.page.keyboard.up("KeyC");
  }

  async run(init: { spawn: { x: number; z: number } }): Promise<void> {
    await this.session.page.evaluate(() => {
      const prompt = document.getElementById("interact-prompt");
      if (prompt) prompt.style.display = "none";
    });
    const at = { x: init.spawn.x, z: init.spawn.z };
    await this.session.page.keyboard.down("KeyC");
    for (const kind of ViewpointPlanner.pickupKinds()) {
      const view = this.planner.facing(`pickup-${kind}`, at.x, at.z, 0.5, 1.25);
      if (!view) continue;
      await this.session.page.evaluate(({ k, p }) => {
        (window as unknown as DevWindow).nachsitzenDev.pickups.add({ id: `gallery-${k}`, kind: k, x: p.x, z: p.z });
      }, { k: kind, p: at });
      await this.probe.place(view, 5);
      await this.session.page.waitForTimeout(400);
      this.report[kind] = { at, meshes: await this.meshesNear(at) };
      await this.probe.screenshot(this.env.screenshotPath(`pickup-${kind}`));
      await this.session.page.evaluate((k) => {
        (window as unknown as DevWindow).nachsitzenDev.pickups.remove(`gallery-${k}`);
      }, kind);
    }
    await this.session.page.keyboard.up("KeyC");
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
    await gallery.run(init);
    await gallery.crouchClassroom();
    writeFileSync(
      env.jsonPath().replace("perf.json", "pickups.json"),
      JSON.stringify(gallery.report, null, 2),
    );
  } finally {
    await session.close();
    await context.close();
  }
});
