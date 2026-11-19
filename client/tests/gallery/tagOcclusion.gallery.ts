import { join } from "node:path";
import { writeFileSync } from "node:fs";
import type { Page } from "@playwright/test";
import { expect, test } from "../pointerLockStub";
import type { GalleryApi } from "./GalleryApp";
import { GalleryPlan } from "./GalleryPlan";
import { GallerySession } from "./GallerySession";
import { PixelDiff } from "./PixelDiff";
import { TagShots } from "./TagShots";

type Counts = { hidden: number; visible: number; tag: number };

type Scenario = {
  label: string;
  layout: string;
  azimuth: number;
  hat?: string;
  hide?: boolean;
  throughOpening?: boolean;
};

class OcclusionRig {
  static readonly HIDDEN_LIMIT = 20;
  static readonly VISIBLE_MINIMUM = 300;
  static readonly DISTANCE = 6;

  readonly counts: Record<string, Counts> = {};
  readonly files: Record<string, string[]> = {};

  constructor(
    private readonly page: Page,
    private readonly shots: TagShots,
    private readonly diff: PixelDiff,
    private readonly folder: string,
  ) {}

  private api<T>(call: (api: GalleryApi) => T | Promise<T>): Promise<T> {
    return this.page.evaluate(
      `(${call.toString()})(window.cosmeticGallery)`,
    ) as Promise<T>;
  }

  private layout(name: string | null): Promise<void> {
    return this.page.evaluate(
      (value) => (window as unknown as { cosmeticGallery: GalleryApi }).cosmeticGallery.setLayout(value),
      name,
    );
  }

  private flag(method: "setHidden" | "setTagVisible", value: boolean): Promise<void> {
    return this.page.evaluate(
      ([name, on]) => (window as unknown as { cosmeticGallery: GalleryApi })
        .cosmeticGallery[name as "setHidden" | "setTagVisible"](on as boolean),
      [method, value] as const,
    );
  }

  private spot(): Promise<[number, number]> {
    return this.page.evaluate(
      () => (window as unknown as { cosmeticGallery: GalleryApi }).cosmeticGallery.playerSpot(),
    );
  }

  private leave(): Promise<void> {
    return this.page.evaluate(
      () => (window as unknown as { cosmeticGallery: GalleryApi }).cosmeticGallery.probe.leave("p1"),
    );
  }

  private async shoot(name: string): Promise<Buffer> {
    return this.page.screenshot({ path: join(this.folder, `${name}.png`) });
  }

  private async pair(
    scenario: Scenario, layout: string | null, tag: string,
  ): Promise<{ player: Buffer; tagOff: Buffer; empty: Buffer }> {
    await this.layout(layout);
    const spot = await this.spot();
    const hat = scenario.hat ?? "hat_wizard";
    const equipped = hat === "none" ? { title: GalleryPlan.TITLE } : { hat, title: GalleryPlan.TITLE };
    await this.shots.show(equipped, spot);
    if (scenario.hide) await this.flag("setHidden", true);
    const view = TagShots.around(spot, OcclusionRig.DISTANCE, scenario.azimuth);
    await this.shots.aim(view);
    const player = await this.shoot(`${scenario.label}_${tag}_player`);
    await this.flag("setTagVisible", false);
    await this.shots.aim(view);
    const tagOff = await this.shoot(`${scenario.label}_${tag}_tagoff`);
    await this.leave();
    await this.shots.aim(view);
    const empty = await this.shoot(`${scenario.label}_${tag}_empty`);
    return { player, tagOff, empty };
  }

  async run(scenario: Scenario): Promise<void> {
    const behind = await this.pair(scenario, scenario.layout, "wall");
    const open = await this.pair({ ...scenario, hide: false }, null, "open");
    this.counts[scenario.label] = {
      hidden: await this.diff.count(behind.player, behind.empty),
      visible: await this.diff.count(open.player, open.empty),
      tag: await this.diff.count(behind.player, behind.tagOff),
    };
    this.files[scenario.label] = [
      join(this.folder, `${scenario.label}_wall_player.png`),
      join(this.folder, `${scenario.label}_open_player.png`),
    ];
  }
}

class OcclusionPlan {
  static scenarios(): Scenario[] {
    const list: Scenario[] = [{ label: "far_wall", layout: "distant", azimuth: 0 }];
    for (const azimuth of [0, 35, 60, -35, -60]) {
      list.push({ label: `pressed_${azimuth}`, layout: "wall", azimuth });
      list.push({ label: `pressed_${azimuth}_control`, layout: "wall", azimuth, hat: "hat_crown" });
    }
    for (const azimuth of [0, 35, 60, -90, -55, -30, -45]) {
      list.push({ label: `corner_${azimuth}`, layout: "corner", azimuth });
    }
    for (const azimuth of [0, 35, 60, -35, -60]) {
      list.push({
        label: `doorway_${azimuth}`, layout: "doorway", azimuth, throughOpening: azimuth === 0 || azimuth === 35,
      });
    }
    for (const azimuth of [0, 35, 60, -35, -60]) {
      list.push({ label: `door_${azimuth}`, layout: "door", azimuth });
      list.push({ label: `door_${azimuth}_bare`, layout: "door", azimuth, hat: "none" });
    }
    for (const azimuth of [0, 35, 60, 145, 180]) {
      list.push({ label: `locker_hidden_${azimuth}`, layout: "locker", azimuth, hide: true });
    }
    return list;
  }
}

test("a wall hides the name tag of a player standing against it", async ({ context, page }) => {
  const session = new GallerySession(context, page);
  await session.open();
  const shots = new TagShots(page, session.sheets(), session.outDir);
  const rig = new OcclusionRig(page, shots, new PixelDiff(session.sheets()), shots.folder("occlusion"));
  const scenarios = OcclusionPlan.scenarios();
  for (const scenario of scenarios) await rig.run(scenario);

  writeFileSync(join(session.outDir, "occlusion.json"), JSON.stringify(rig.counts, null, 1));
  await shots.sheet(
    "sheet_occlusion", "tag behind a grid wall (left) and in the open (right)", ["behind wall", "open"],
    scenarios.map((s) => ({ label: s.label, files: rig.files[s.label] })), 130,
  );
  for (const scenario of scenarios) {
    const count = rig.counts[scenario.label];
    const name = scenario.label;
    expect(count.visible, `${name}: tag and player visible without the wall`)
      .toBeGreaterThan(OcclusionRig.VISIBLE_MINIMUM);
    if (scenario.throughOpening) continue;
    expect(count.hidden, `${name}: nothing of the player shows through the wall`)
      .toBeLessThan(OcclusionRig.HIDDEN_LIMIT);
    expect(count.tag, `${name}: no name tag pixels show through the wall`)
      .toBeLessThan(OcclusionRig.HIDDEN_LIMIT);
  }
  await session.close();
});
