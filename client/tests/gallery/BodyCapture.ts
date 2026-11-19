import { join } from "node:path";
import { mkdirSync } from "node:fs";
import type { Page } from "@playwright/test";
import type { CatalogItem, EquippedCosmetics } from "../../src/net/protocol";
import type { GalleryApi } from "./GalleryApp";
import { ContactSheet, type SheetRow } from "./ContactSheet";
import { GalleryPlan, type CameraShot, type Vec3 } from "./GalleryPlan";

export class BodyCapture {
  static readonly CLOSE = 1.1;

  private readonly shots: string;

  constructor(
    private readonly page: Page,
    private readonly sheetPage: Page,
    private readonly plan: GalleryPlan,
    private readonly outDir: string,
  ) {
    this.shots = join(outDir, "body");
    mkdirSync(this.shots, { recursive: true });
  }

  private static ring(distance: number, focus: number, names: string[], height = 0.1): CameraShot[] {
    const target: Vec3 = [0, focus, 0];
    const k = Math.SQRT1_2 * distance;
    const spots: Record<string, [number, number]> = {
      front: [0, -distance], side: [distance, 0], back: [0, distance], front34: [-k, -k], back34: [k, k],
    };
    return names.map((name) => ({
      name, position: [spots[name][0], focus + height, spots[name][1]] as Vec3, target, crop: false,
    }));
  }

  headShots(): CameraShot[] {
    return BodyCapture.ring(BodyCapture.CLOSE, 1.62, ["front", "side", "front34", "back"]);
  }

  backShots(): CameraShot[] {
    return BodyCapture.ring(2.0, 1.15, ["back", "side", "back34"]);
  }

  private frames(count = 3): Promise<void> {
    return this.page.evaluate(
      (n) => (window as unknown as { cosmeticGallery: GalleryApi }).cosmeticGallery.frames(n), count,
    );
  }

  private async show(equipped: EquippedCosmetics, avatar: boolean): Promise<void> {
    await this.page.evaluate(
      async ([eq, withAvatar]) => {
        const api = (window as unknown as { cosmeticGallery: GalleryApi }).cosmeticGallery;
        await api.showRemote(eq as EquippedCosmetics, 0, { avatar: withAvatar as boolean });
      },
      [{ ...equipped, title: GalleryPlan.TITLE }, avatar] as const,
    );
  }

  private async shoot(shot: CameraShot, file: string): Promise<void> {
    await this.page.evaluate(
      ([position, target]) => (window as unknown as { cosmeticGallery: GalleryApi })
        .cosmeticGallery.setCamera(position, target),
      [shot.position, shot.target] as const,
    );
    await this.frames();
    await this.page.screenshot({ path: file });
  }

  async items(category: string, items: CatalogItem[], shots: CameraShot[], tileHeight: number): Promise<void> {
    const rows: SheetRow[] = [];
    for (const item of items) {
      await this.show({ [item.category]: item.id }, false);
      const files: string[] = [];
      for (const shot of shots) {
        const file = join(this.shots, `${category}_${item.id}_${shot.name}.png`);
        await this.shoot(shot, file);
        files.push(file);
      }
      rows.push({ label: item.id, files });
    }
    await new ContactSheet(this.sheetPage, tileHeight, 1).write(
      join(this.outDir, `body_${category}.png`), `body ${category}`, shots.map((s) => s.name), rows,
    );
  }

  async looks(): Promise<void> {
    const distances = [2, 8];
    const names = ["front", "side", "back"];
    const rows: SheetRow[] = [];
    for (const [label, avatar] of [["plain", false], ["avatar", true]] as const) {
      await this.show({}, avatar);
      const files: string[] = [];
      for (const distance of distances) {
        for (const shot of BodyCapture.ring(distance, 1.0, names, 0.3)) {
          const file = join(this.shots, `look_${label}_${shot.name}_${distance}m.png`);
          await this.shoot(shot, file);
          files.push(file);
        }
      }
      rows.push({ label, files });
    }
    await new ContactSheet(this.sheetPage, 230, 1).write(
      join(this.outDir, "body_looks.png"), "body looks 2m then 8m",
      distances.flatMap((d) => names.map((n) => `${n}_${d}m`)), rows,
    );
  }

  async themes(themes: CatalogItem[]): Promise<void> {
    const rows: SheetRow[] = [];
    for (const theme of themes) {
      await this.show({ body: theme.id }, false);
      const files: string[] = [];
      for (const shot of BodyCapture.ring(2, 1.0, ["front", "back"], 0.3)) {
        const file = join(this.shots, `theme_${theme.id}_${shot.name}.png`);
        await this.shoot(shot, file);
        files.push(file);
      }
      rows.push({ label: theme.id, files });
    }
    await new ContactSheet(this.sheetPage, 230, 1).write(
      join(this.outDir, "body_themes.png"), "body themes 2m", ["front", "back"], rows,
    );
  }
}
