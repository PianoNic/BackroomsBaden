import { join } from "node:path";
import { writeFileSync } from "node:fs";
import type { Page } from "@playwright/test";
import { expect, test } from "../pointerLockStub";
import type { GalleryApi } from "./GalleryApp";
import { GalleryPlan, type CameraShot } from "./GalleryPlan";
import { GallerySession } from "./GallerySession";
import { PixelDiff } from "./PixelDiff";
import { TagShots } from "./TagShots";

class OcclusionRig {
  static readonly COLLISION_RADIUS = 0.4;
  static readonly WALL_THICKNESS = 0.2;
  static readonly HIDDEN_LIMIT = 20;
  static readonly VISIBLE_MINIMUM = 300;
  static readonly OBLIQUE_ALLOWANCE = 400;

  readonly counts: Record<string, { hidden: number; visible: number }> = {};

  constructor(
    private readonly page: Page,
    private readonly shots: TagShots,
    private readonly diff: PixelDiff,
    private readonly folder: string,
  ) {}

  private wall(on: boolean, centerZ: number): Promise<void> {
    return this.page.evaluate(
      ([flag, z]) => (window as unknown as { cosmeticGallery: GalleryApi })
        .cosmeticGallery.setWall(flag as boolean, z as number),
      [on, centerZ] as const,
    );
  }

  private leave(): Promise<void> {
    return this.page.evaluate(
      () => (window as unknown as { cosmeticGallery: GalleryApi }).cosmeticGallery.probe.leave("p1"),
    );
  }

  private async pair(view: CameraShot, label: string, hat: string): Promise<Buffer[]> {
    await this.shots.show({ hat, title: GalleryPlan.TITLE });
    await this.shots.aim(view);
    const withPlayer = await this.page.screenshot({ path: join(this.folder, `${label}_player.png`) });
    await this.leave();
    await this.shots.aim(view);
    const without = await this.page.screenshot({ path: join(this.folder, `${label}_empty.png`) });
    return [withPlayer, without];
  }

  async run(label: string, view: CameraShot, wallCenterZ: number, hat = "hat_wizard"): Promise<void> {
    await this.wall(true, wallCenterZ);
    const [behind, wallOnly] = await this.pair(view, `${label}_wall`, hat);
    await this.wall(false, wallCenterZ);
    const [open, empty] = await this.pair(view, `${label}_open`, hat);
    this.counts[label] = {
      hidden: await this.diff.count(behind, wallOnly),
      visible: await this.diff.count(open, empty),
    };
  }

  static pressedCenterZ(): number {
    return -(OcclusionRig.COLLISION_RADIUS + OcclusionRig.WALL_THICKNESS / 2);
  }
}

test("a wall still hides the name tag of a wizard standing behind it", async ({ context, page }) => {
  const session = new GallerySession(context, page);
  await session.open();
  const shots = new TagShots(page, session.sheets(), session.outDir);
  const rig = new OcclusionRig(page, shots, new PixelDiff(session.sheets()), shots.folder("occlusion"));

  await rig.run("far_wall", TagShots.shot("front", 6, false), -3);
  const pressed = OcclusionRig.pressedCenterZ();
  await rig.run("pressed_head_on", TagShots.orbit("front", 6, 0), pressed);
  const oblique35 = TagShots.orbit("oblique35", 6, 35);
  const oblique60 = TagShots.orbit("oblique60", 6, 60);
  await rig.run("pressed_35deg", oblique35, pressed);
  await rig.run("pressed_35deg_control", oblique35, pressed, "hat_crown");
  await rig.run("pressed_60deg", oblique60, pressed);
  await rig.run("pressed_60deg_control", oblique60, pressed, "hat_crown");

  writeFileSync(join(session.outDir, "occlusion.json"), JSON.stringify(rig.counts, null, 1));
  const headOn = ["far_wall", "pressed_head_on"];
  for (const label of headOn) {
    const count = rig.counts[label];
    expect(count.visible, `${label}: tag and player visible without the wall`).toBeGreaterThan(OcclusionRig.VISIBLE_MINIMUM);
    expect(count.hidden, `${label}: the wall hides the tag and the player`).toBeLessThan(OcclusionRig.HIDDEN_LIMIT);
  }
  for (const label of ["pressed_35deg", "pressed_60deg"]) {
    const pushed = rig.counts[label];
    const control = rig.counts[`${label}_control`];
    expect(pushed.visible, `${label}: tag and player visible without the wall`).toBeGreaterThan(OcclusionRig.VISIBLE_MINIMUM);
    expect(pushed.hidden, `${label}: the push leaks no more than a hat that needs none`)
      .toBeLessThanOrEqual(control.hidden + OcclusionRig.OBLIQUE_ALLOWANCE);
  }
  await session.close();
});
