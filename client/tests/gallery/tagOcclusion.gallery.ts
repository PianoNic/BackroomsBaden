import { join } from "node:path";
import { writeFileSync } from "node:fs";
import { expect, test } from "../pointerLockStub";
import type { GalleryApi } from "./GalleryApp";
import { GalleryPlan } from "./GalleryPlan";
import { GallerySession } from "./GallerySession";
import { PixelDiff } from "./PixelDiff";
import { TagShots } from "./TagShots";

test("a wall still hides the name tag of a wizard standing behind it", async ({ context, page }) => {
  const session = new GallerySession(context, page);
  await session.open();
  const shots = new TagShots(page, session.sheets(), session.outDir);
  const diff = new PixelDiff(session.sheets());
  const wall = (on: boolean): Promise<void> => page.evaluate(
    (flag) => (window as unknown as { cosmeticGallery: GalleryApi }).cosmeticGallery.setWall(flag), on,
  );
  const leave = (): Promise<void> => page.evaluate(
    () => (window as unknown as { cosmeticGallery: GalleryApi }).cosmeticGallery.probe.leave("p1"),
  );
  const view = TagShots.shot("front", 6, false);
  const folder = shots.folder("occlusion");

  await shots.show({ hat: "hat_wizard", title: GalleryPlan.TITLE });
  await wall(true);
  await shots.aim(view);
  const behindWall = await page.screenshot({ path: join(folder, "wall_with_player.png") });
  await leave();
  await shots.aim(view);
  const wallOnly = await page.screenshot({ path: join(folder, "wall_only.png") });

  await wall(false);
  await shots.show({ hat: "hat_wizard", title: GalleryPlan.TITLE });
  await shots.aim(view);
  const openAir = await page.screenshot({ path: join(folder, "open_with_player.png") });
  await leave();
  await shots.aim(view);
  const emptyAir = await page.screenshot({ path: join(folder, "open_empty.png") });

  const hidden = await diff.count(behindWall, wallOnly);
  const visible = await diff.count(openAir, emptyAir);
  writeFileSync(join(session.outDir, "occlusion.json"), JSON.stringify({ hidden, visible }));
  expect(visible, "the tag and player are visible without the wall").toBeGreaterThan(300);
  expect(hidden, "the wall hides the tag and the player").toBeLessThan(20);
  await session.close();
});
