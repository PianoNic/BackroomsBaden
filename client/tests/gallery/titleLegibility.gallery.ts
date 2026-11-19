import { join } from "node:path";
import { test } from "../pointerLockStub";
import { GalleryPlan } from "./GalleryPlan";
import { GallerySession } from "./GallerySession";
import { TagShots } from "./TagShots";

test("name tag titles are legible at 6 m", async ({ context, page }) => {
  const session = new GallerySession(context, page);
  const catalog = await session.open();
  const shots = new TagShots(page, session.sheets(), session.outDir);
  const titles = new GalleryPlan(catalog).category("title");
  const rows = [];
  for (const title of titles) {
    await shots.show({ title: title.id });
    const files: string[] = [];
    for (const distance of [2, 6]) {
      const shot = TagShots.shot("front", distance, false);
      const file = join(shots.folder("title", title.id), `${shot.name}.png`);
      await shots.capture(shot, file);
      files.push(file);
    }
    rows.push({ label: title.id, files });
  }
  await shots.sheet("sheet_title_legibility", "title line at 2m and 6m", ["front_2m", "front_6m"], rows);
  await session.close();
});
