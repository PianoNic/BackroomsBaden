import { test } from "../pointerLockStub";
import { BodyCapture } from "./BodyCapture";
import { GalleryPlan } from "./GalleryPlan";
import { GallerySession } from "./GallerySession";

test("body gallery", async ({ context, page }) => {
  const session = new GallerySession(context, page);
  const catalog = await session.open();
  const plan = new GalleryPlan(catalog);
  const capture = new BodyCapture(page, session.sheets(), plan, session.outDir);
  await capture.looks();
  await capture.themes(plan.category("body").filter((it) => it.assetRef));
  await capture.items("hat", plan.hats(), capture.headShots(), 260);
  await capture.items("mask", plan.category("mask"), capture.headShots(), 260);
  await capture.items("backpack", plan.category("backpack"), capture.backShots(), 300);
  await session.close();
});
