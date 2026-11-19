import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "../pointerLockStub";
import { GalleryPlan } from "./GalleryPlan";
import { GallerySession } from "./GallerySession";
import { TagShots } from "./TagShots";

class TallHatLimits {
  static readonly CEILING = 3;
  static readonly BODY_ORIGIN = 0.85;
  static readonly MAX_PUSH = 0.25;
  static readonly TAG_HEIGHT = 2.4 * (168 / 512);
}

test("tall procedural hats clear the name tag", async ({ context, page }) => {
  const session = new GallerySession(context, page);
  const catalog = await session.open();
  const shots = new TagShots(page, session.sheets(), session.outDir);
  const plan = new GalleryPlan(catalog);
  const procedural = plan.hats().filter((hat) => !plan.isModel(hat));
  const measured: Array<{
    id: string; top: number; radius: number; tag: [number, number] | null; tagForward: number; tagBottomRadius: number;
  }> = [];
  for (const hat of procedural) {
    await shots.show({ hat: hat.id, title: GalleryPlan.TITLE });
    await shots.aim(TagShots.shot("front", 2, false));
    const b = (await shots.bounds())!;
    const radius = Math.max(b.max[0], -b.min[0], b.max[2], -b.min[2]);
    measured.push({ id: hat.id, top: b.max[1], radius, tag: b.tag, tagForward: b.tagForward, tagBottomRadius: b.tagBottomRadius });
  }
  measured.sort((a, b) => b.top - a.top);
  writeFileSync(join(session.outDir, "tallHats.json"), JSON.stringify(measured, null, 1));
  for (const hat of measured) {
    expect(hat.tag, hat.id).not.toBeNull();
    const [bottom, top] = hat.tag!;
    expect(top - bottom, `${hat.id} tag keeps at least 85 percent size`).toBeGreaterThanOrEqual(TallHatLimits.TAG_HEIGHT * 0.85 - 0.01);
    expect(top, `${hat.id} tag top stays under the ceiling`).toBeLessThan(TallHatLimits.CEILING - TallHatLimits.BODY_ORIGIN);
    expect(hat.tagForward, `${hat.id} push stays inside the player collision cylinder`).toBeLessThanOrEqual(TallHatLimits.MAX_PUSH + 1e-3);
    if (bottom < hat.top) {
      expect(hat.tagForward, `${hat.id} tag is drawn in front of the hat`).toBeGreaterThan(hat.tagBottomRadius);
    }
  }
  const tallest = measured.slice(0, 4);
  const views = [
    TagShots.shot("front", 2, false), TagShots.shot("side", 2, true),
    TagShots.shot("front", 6, false), TagShots.shot("side", 6, true),
  ];
  const rows = [];
  for (const hat of tallest) {
    await shots.show({ hat: hat.id, title: GalleryPlan.TITLE });
    const files: string[] = [];
    for (const view of views) {
      const file = join(shots.folder("tallhat", hat.id), `${view.name}.png`);
      await shots.capture(view, file);
      files.push(file);
    }
    rows.push({ label: hat.id, files });
  }
  await shots.sheet("sheet_tall_hats", "tallest procedural hats with tag", views.map((v) => v.name), rows);
  await session.close();
});
