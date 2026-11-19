import { test } from "../pointerLockStub";
import { GalleryCapture } from "./GalleryCapture";
import { GalleryPlan } from "./GalleryPlan";
import { GallerySession } from "./GallerySession";

test("cosmetics pose gallery", async ({ context, page }) => {
  const session = new GallerySession(context, page);
  const catalog = await session.open();
  const capture = new GalleryCapture(page, session.sheets(), new GalleryPlan(catalog), session.outDir);
  await capture.remote();
  await capture.corpses();
  await capture.hands();
  await session.close();
});
