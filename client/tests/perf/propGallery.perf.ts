import { writeFileSync } from "node:fs";
import { test } from "@playwright/test";
import type { Prop } from "../../src/net/protocol";
import { FrameProbe } from "./FrameProbe";
import { GameSession } from "./GameSession";
import { PerfEnvironment } from "./PerfEnvironment";
import { ViewpointPlanner, type Viewpoint } from "./ViewpointPlanner";

const PER_TYPE = 2;
const WALL_TYPES = new Set(["clock", "fire_extinguisher"]);
const SMALL_TYPES = new Set([
  "books_pile", "microscope", "bunsen_burner", "microwave", "laptop", "printer", "papers",
]);

class PropGallery {
  readonly captured: string[] = [];
  readonly skipped: string[] = [];

  constructor(
    private readonly env: PerfEnvironment,
    private readonly planner: ViewpointPlanner,
    private readonly probe: FrameProbe,
    private readonly props: Prop[],
  ) {}

  private pick(): Prop[] {
    const counts = new Map<string, number>();
    const chosen: Prop[] = [];
    const only = process.env.PERF_PROPS ? new Set(process.env.PERF_PROPS.split(",")) : null;
    for (const prop of this.props) {
      if (only && !only.has(prop.type)) continue;
      const seen = counts.get(prop.type) ?? 0;
      if (seen >= PER_TYPE) continue;
      counts.set(prop.type, seen + 1);
      chosen.push(prop);
    }
    return chosen;
  }

  private viewFor(prop: Prop, index: number): Viewpoint | null {
    const distance = SMALL_TYPES.has(prop.type) ? 1.1 : WALL_TYPES.has(prop.type) ? 1.6 : 2.4;
    const lookY = prop.type === "clock" ? 2.5 : SMALL_TYPES.has(prop.type) ? 0.85 : 0.9;
    const front = { dx: -Math.sin(prop.yaw), dz: -Math.cos(prop.yaw) };
    const name = `prop-${prop.type}-${index}`;
    if (this.planner.floor.clearDistance(prop.x, prop.z, front, distance) >= distance) {
      return {
        name, x: prop.x + front.dx * distance, z: prop.z + front.dz * distance,
        lookX: prop.x, lookZ: prop.z, lookY, measure: false,
      };
    }
    return this.planner.facing(name, prop.x, prop.z, distance, lookY);
  }

  async run(): Promise<void> {
    if (process.env.PERF_BRIGHT === "1") await this.probe.brighten();
    const seenPerType = new Map<string, number>();
    for (const prop of this.pick()) {
      const index = seenPerType.get(prop.type) ?? 0;
      seenPerType.set(prop.type, index + 1);
      const view = this.viewFor(prop, index);
      if (!view) {
        this.skipped.push(`${prop.type}-${index}`);
        continue;
      }
      await this.probe.place(view, 20);
      await this.probe.screenshot(this.env.screenshotPath(view.name));
      this.captured.push(`${view.name} x=${prop.x.toFixed(2)} z=${prop.z.toFixed(2)} yaw=${prop.yaw.toFixed(2)}`);
    }
  }
}

test("prop gallery", async ({ browser }) => {
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
    const gallery = new PropGallery(env, planner, probe, init.props);
    await gallery.run();
    writeFileSync(
      env.jsonPath().replace("perf.json", "gallery.json"),
      JSON.stringify({ captured: gallery.captured, skipped: gallery.skipped }, null, 2),
    );
  } finally {
    await session.close();
    await context.close();
  }
});
