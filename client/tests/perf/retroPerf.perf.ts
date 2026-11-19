import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { test } from "@playwright/test";
import { AssetSizer } from "./AssetSizer";
import { FrameProbe, type FrameMeasurement } from "./FrameProbe";
import { GameSession } from "./GameSession";
import { PerfEnvironment } from "./PerfEnvironment";
import { ViewpointPlanner, type Viewpoint } from "./ViewpointPlanner";

const PARK = -1000;
const SETTLE_AFTER_START_MS = 10_000;

type ViewpointResult = {
  name: string;
  x: number;
  z: number;
  yaw: number;
  pitch: number;
  measurement: FrameMeasurement | null;
};

class RetroPerfRun {
  readonly results: ViewpointResult[] = [];
  readonly captured: string[] = [];
  readonly skipped: string[] = [];

  constructor(
    private readonly env: PerfEnvironment,
    private readonly session: GameSession,
    private readonly probe: FrameProbe,
    private readonly planner: ViewpointPlanner,
  ) {}

  async visit(view: Viewpoint | null, settleFrames = 90): Promise<void> {
    if (!view) return;
    const { yaw, pitch } = await this.probe.place(view, settleFrames);
    const measurement = view.measure
      ? await this.probe.measure(PerfEnvironment.WARMUP_FRAMES, PerfEnvironment.SAMPLE_FRAMES)
      : null;
    await this.session.page.screenshot({ path: this.env.screenshotPath(view.name) });
    this.captured.push(view.name);
    this.results.push({ name: view.name, x: view.x, z: view.z, yaw, pitch, measurement });
  }

  async visitTeachers(): Promise<void> {
    const near = await this.probe.teacherPositions();
    if (near.length === 0) {
      this.skipped.push("teacher-near", "teacher-far");
      return;
    }
    const first = near[0];
    const nearView = this.planner.facing("teacher-near", first.x, first.z, 2, 1.3);
    await this.visit(nearView, 6);
    const live = (await this.probe.teacherPositions())[0];
    const { dir, distance } = this.planner.longestClear(live.x, live.z, 12);
    const reach = Math.min(12, distance - 0.5);
    if (reach < 4) {
      this.skipped.push("teacher-far");
      return;
    }
    await this.visit({
      name: "teacher-far", x: live.x + dir.dx * reach, z: live.z + dir.dz * reach,
      lookX: live.x, lookZ: live.z, lookY: 1.3, measure: false,
    }, 6);
  }

  async visitRemote(): Promise<void> {
    const spawn = this.planner.atrium();
    const { dir, distance } = this.planner.longestClear(spawn.x, spawn.z, 4);
    const reach = Math.max(1.5, Math.min(3, distance - 0.5));
    const botX = spawn.x + dir.dx * reach;
    const botZ = spawn.z + dir.dz * reach;
    for (let i = 0; i < 5; i++) {
      await this.session.botSend({ type: "move", x: botX, z: botZ, yaw: 0 });
      await this.session.page.waitForTimeout(200);
    }
    await this.session.page.waitForTimeout(2000);
    await this.visit(this.planner.facing("remote-player", botX, botZ, 3, 1.2), 30);
  }

  async visitCorpse(): Promise<void> {
    let dead: { x: number; z: number } | null = null;
    const deadline = Date.now() + 60_000;
    while (!dead && Date.now() < deadline) {
      const teachers = await this.probe.teacherPositions();
      if (teachers.length > 0) {
        await this.session.botSend({ type: "move", x: teachers[0].x, z: teachers[0].z, yaw: 0 });
      }
      await this.session.page.waitForTimeout(150);
      dead = await this.session.botKilled();
    }
    if (!dead) {
      this.skipped.push("corpse");
      return;
    }
    await this.session.page.waitForTimeout(1500);
    await this.visit(this.planner.facing("corpse", dead.x, dead.z, 2.5, 0.2), 30);
  }
}

test("retro art pass perf and screenshots", async ({ browser }) => {
  const env = new PerfEnvironment();
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 1,
  });
  const session = new GameSession(context);
  try {
    const init = await session.start();
    const page = session.page;
    await page.waitForTimeout(SETTLE_AFTER_START_MS);
    await session.parkMain(PARK, PARK);
    await session.botSend({ type: "move", x: PARK, z: PARK, yaw: 0 });

    const planner = new ViewpointPlanner(init);
    const probe = new FrameProbe(page);
    await probe.calibrate(init.spawn.x, init.spawn.z);
    const run = new RetroPerfRun(env, session, probe, planner);

    await run.visit(planner.atrium());
    await run.visit(planner.corridor());
    await run.visit(planner.junction());
    for (const room of planner.roomViews()) await run.visit(room);
    for (const kind of ViewpointPlanner.pickupKinds()) await run.visit(planner.pickup(kind), 30);
    await run.visit(planner.door(), 30);
    const totals = await probe.sceneTotals();
    await run.visitTeachers();
    await run.visitRemote();
    await run.visitCorpse();

    const clientRoot = fileURLToPath(new URL("../..", import.meta.url));
    const sizer = new AssetSizer(`${clientRoot}/public`, env.buildDir);
    const sizes = sizer.measure();
    writeFileSync(env.sizesPath(), sizer.format(sizes));
    writeFileSync(env.jsonPath(), JSON.stringify({
      seed: PerfEnvironment.SEED,
      mapSize: PerfEnvironment.MAP_SIZE,
      warmupFrames: PerfEnvironment.WARMUP_FRAMES,
      sampleFrames: PerfEnvironment.SAMPLE_FRAMES,
      scene: totals,
      sizes,
      viewpoints: run.results,
      screenshots: run.captured,
      skipped: [...planner.skipped, ...run.skipped],
    }, null, 2));
  } finally {
    await context.close();
  }
});
