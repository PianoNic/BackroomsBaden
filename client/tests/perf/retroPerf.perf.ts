import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { test } from "@playwright/test";
import type { PickupKind } from "../../src/net/protocol";
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
    console.log(`viewpoint ${view.name}`);
    const { yaw, pitch } = await this.probe.place(view, settleFrames);
    const measurement = view.measure
      ? await this.probe.measure(PerfEnvironment.WARMUP_FRAMES, PerfEnvironment.SAMPLE_FRAMES)
      : null;
    await this.probe.screenshot(this.env.screenshotPath(view.name));
    this.captured.push(view.name);
    this.results.push({ name: view.name, x: view.x, z: view.z, yaw, pitch, measurement });
  }

  async visitPickups(): Promise<void> {
    const wanted = new Set<PickupKind>(ViewpointPlanner.pickupKinds());
    const found = new Map<PickupKind, { x: number; z: number; fromX: number; fromZ: number }>();
    for (const locker of this.planner.lockersBySpawnDistance()) {
      if (found.size === wanted.size) break;
      await this.session.openLocker(locker.id, locker.x, locker.z);
      for (const spawn of await this.session.spawnedPickups()) {
        if (!found.has(spawn.kind)) {
          found.set(spawn.kind, { x: spawn.x, z: spawn.z, fromX: locker.x, fromZ: locker.z });
        }
      }
    }
    await this.session.page.waitForTimeout(1000);
    for (const kind of wanted) {
      const at = found.get(kind);
      if (at) await this.visit(this.planner.pickup(kind, at.x, at.z, at.fromX, at.fromZ), 30);
      else this.skipped.push(`pickup-${kind}`);
    }
  }

  async visitTeachers(): Promise<void> {
    if ((await this.probe.teacherPositions()).length === 0) {
      this.skipped.push("teacher-near", "teacher-far");
      return;
    }
    await this.visitTeacher("teacher-near", 2);
    await this.visitTeacher("teacher-far", 12);
  }

  private async visitTeacher(name: string, distance: number): Promise<void> {
    const all = await this.probe.teacherPositions();
    const reachOf = (t: { x: number; z: number }): number =>
      this.planner.longestClear(t.x, t.z, distance).distance;
    const live = distance > 4 ? all.reduce((a, b) => (reachOf(b) > reachOf(a) ? b : a)) : all[0];
    let view: Viewpoint | null;
    if (distance > 4) {
      const clear = this.planner.longestClear(live.x, live.z, distance);
      const reach = Math.min(distance, clear.distance - 0.5);
      view = reach < 4 ? null : {
        name, x: live.x + clear.dir.dx * reach, z: live.z + clear.dir.dz * reach,
        lookX: live.x, lookZ: live.z, lookY: 1.3, measure: false,
      };
    } else {
      view = this.planner.facing(name, live.x, live.z, distance, 1.3);
    }
    if (!view) {
      this.skipped.push(name);
      return;
    }
    await this.visit(view, 1);
  }

  async visitRemote(): Promise<void> {
    const spawn = this.planner.spawn();
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

    console.log(`renderer ${(await probe.sceneTotals()).renderer}, ${(await probe.framesPerSecond(3000)).toFixed(1)} fps at spawn`);
    await run.visit(planner.spawn());
    await run.visit(planner.atrium());
    await run.visit(planner.corridor());
    await run.visit(planner.junction());
    for (const room of planner.roomViews()) await run.visit(room);
    await run.visit(planner.door(), 30);
    await run.visitPickups();
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
    await session.close();
    await context.close();
  }
});
