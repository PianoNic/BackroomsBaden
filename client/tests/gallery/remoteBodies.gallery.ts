import { writeFileSync } from "node:fs";
import { test } from "../pointerLockStub";
import { FrameProbe, type FrameMeasurement } from "./FrameProbe";
import { GameSession } from "./GameSession";
import { GalleryEnvironment } from "./GalleryEnvironment";
import { RemoteShots } from "./RemoteShots";
import { ViewpointPlanner, type Viewpoint } from "./ViewpointPlanner";

const PARK = -1000;
const SETTLE_AFTER_START_MS = 10_000;
const WARMUP_FRAMES = 6;
const SAMPLE_FRAMES = 24;

type Row = { name: string; measurement: FrameMeasurement | null };

class BodyRun {
  readonly rows: Row[] = [];

  constructor(
    private readonly env: GalleryEnvironment,
    private readonly session: GameSession,
    private readonly probe: FrameProbe,
    private readonly planner: ViewpointPlanner,
  ) {}

  async visit(view: Viewpoint | null, settle = 20): Promise<void> {
    if (!view) return;
    console.log(`viewpoint ${view.name}`);
    await this.probe.place(view, settle);
    const measurement = view.measure ? await this.probe.measure(WARMUP_FRAMES, SAMPLE_FRAMES) : null;
    await this.probe.screenshot(this.env.screenshotPath(view.name));
    this.rows.push({ name: view.name, measurement });
  }

  async remotes(): Promise<void> {
    const spawn = this.planner.spawn();
    const { dir, distance } = this.planner.longestClear(spawn.x, spawn.z, 9);
    const remote = new RemoteShots(this.session, this.session.page);
    const near = Math.max(1.5, Math.min(2, distance - 0.5));
    const far = Math.min(8, distance - 0.5);
    const nearAt = { x: spawn.x + dir.dx * near, z: spawn.z + dir.dz * near };
    const farAt = { x: spawn.x + dir.dx * far, z: spawn.z + dir.dz * far };
    const facing = Math.atan2(dir.dx, dir.dz);
    const base: Viewpoint = {
      name: "remote-baseline", x: spawn.x, z: spawn.z, lookX: nearAt.x, lookZ: nearAt.z, lookY: 1.0, measure: true,
    };
    await remote.place(PARK, PARK, 0);
    await this.visit(base);
    await remote.place(nearAt.x, nearAt.z, facing);
    await this.visit({ ...base, name: "remote-one-player" });
    await remote.addExtras(spawn.x, spawn.z, dir, 2);
    await this.visit({ ...base, name: "remote-three-players" });
    await remote.clearExtras(2);
    for (const shot of remote.shots(spawn.x, spawn.z, dir, distance - 0.5)) {
      const look = RemoteShots.LOOKS.find((l) => l.name === shot.look)!;
      if (shot.side === "front" && shot.distance === RemoteShots.DISTANCES[0]) await remote.dress(look);
      const at = shot.distance > 4 ? farAt : nearAt;
      await remote.place(at.x, at.z, shot.yaw);
      await this.visit({ ...shot.view, lookX: at.x, lookZ: at.z });
    }
  }

  async corpse(): Promise<void> {
    let dead: { x: number; z: number } | null = null;
    const deadline = Date.now() + 90_000;
    while (!dead && Date.now() < deadline) {
      const teachers = await this.probe.teacherPositions();
      if (teachers.length > 0) {
        await this.session.botSend({ type: "move", x: teachers[0].x, z: teachers[0].z, yaw: 0 });
      }
      await this.session.page.waitForTimeout(150);
      dead = await this.session.botKilled();
    }
    if (!dead) return;
    await this.session.page.waitForTimeout(1500);
    await this.visit(this.planner.facing("remote-corpse", dead.x, dead.z, 2.5, 0.2));
    await this.visit(this.planner.facing("remote-corpse-far", dead.x, dead.z, 6, 0.2));
  }
}

test("remote body screenshots and draw-call cost", async ({ context }) => {
  test.setTimeout(1_800_000);
  const env = new GalleryEnvironment();
  env.prepare();
  const session = new GameSession(context);
  try {
    const init = await session.start();
    await session.page.waitForTimeout(SETTLE_AFTER_START_MS);
    await session.parkMain(PARK, PARK);
    await session.botSend({ type: "move", x: PARK, z: PARK, yaw: 0 });
    const planner = new ViewpointPlanner(init);
    const probe = new FrameProbe(session.page);
    await probe.calibrate(init.spawn.x, init.spawn.z);
    const run = new BodyRun(env, session, probe, planner);
    await run.visit({ ...planner.spawn(), name: "remote-spawn", measure: true });
    await run.remotes();
    await run.corpse();
    writeFileSync(env.jsonPath("remoteBodies"), JSON.stringify(run.rows, null, 2));
  } finally {
    await session.close();
  }
});
