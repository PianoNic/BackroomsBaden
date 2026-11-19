import { mkdirSync } from "node:fs";
import { join } from "node:path";
import type { Page } from "@playwright/test";
import type { EquippedCosmetics } from "../../src/net/protocol";
import type { GalleryApi } from "./GalleryApp";
import { ContactSheet, type SheetRow } from "./ContactSheet";
import { type CameraShot, type Vec3 } from "./GalleryPlan";

export type GalleryBounds = ReturnType<GalleryApi["bounds"]>;

export class TagShots {
  static readonly FOCUS = 2.0;
  static readonly CROP = { width: 480, height: 270 };

  constructor(
    private readonly page: Page,
    private readonly sheetPage: Page,
    private readonly outDir: string,
  ) {}

  static shot(name: string, distance: number, side: boolean): CameraShot {
    const target: Vec3 = [0, TagShots.FOCUS, 0];
    const eye = TagShots.FOCUS + 0.1;
    const position: Vec3 = side ? [distance, eye, 0] : [0, eye, -distance];
    return { name: `${name}_${distance}m`, position, target, crop: distance > 4 };
  }

  static orbit(name: string, distance: number, degrees: number): CameraShot {
    const target: Vec3 = [0, TagShots.FOCUS, 0];
    const eye = TagShots.FOCUS + 0.1;
    const angle = (degrees * Math.PI) / 180;
    const position: Vec3 = [distance * Math.sin(angle), eye, -distance * Math.cos(angle)];
    return { name: `${name}_${distance}m`, position, target, crop: false };
  }

  static around(spot: [number, number], distance: number, azimuth: number): CameraShot {
    const target: Vec3 = [spot[0], TagShots.FOCUS, spot[1]];
    const eye = TagShots.FOCUS + 0.1;
    const angle = (azimuth * Math.PI) / 180;
    const position: Vec3 = [
      spot[0] + distance * Math.sin(angle), eye, spot[1] - distance * Math.cos(angle),
    ];
    return { name: `az${azimuth}_${distance}m`, position, target, crop: false };
  }

  async show(equipped: EquippedCosmetics, spot: [number, number] = [0, 0]): Promise<void> {
    await this.page.evaluate(
      ([eq, at]) => (window as unknown as { cosmeticGallery: GalleryApi })
        .cosmeticGallery.showRemote(eq, 0, at[0], at[1]),
      [equipped, spot] as const,
    );
  }

  async bounds(): Promise<GalleryBounds> {
    return this.page.evaluate(
      () => (window as unknown as { cosmeticGallery: GalleryApi }).cosmeticGallery.bounds(),
    );
  }

  async aim(shot: CameraShot): Promise<void> {
    await this.page.evaluate(
      ([position, target]) => (window as unknown as { cosmeticGallery: GalleryApi })
        .cosmeticGallery.setCamera(position, target),
      [shot.position, shot.target] as const,
    );
    await this.page.evaluate(
      () => (window as unknown as { cosmeticGallery: GalleryApi }).cosmeticGallery.frames(4),
    );
  }

  async capture(shot: CameraShot, file: string): Promise<void> {
    await this.page.evaluate(
      ([position, target]) => (window as unknown as { cosmeticGallery: GalleryApi })
        .cosmeticGallery.setCamera(position, target),
      [shot.position, shot.target] as const,
    );
    await this.page.evaluate(
      () => (window as unknown as { cosmeticGallery: GalleryApi }).cosmeticGallery.frames(4),
    );
    const size = this.page.viewportSize()!;
    const crop = TagShots.CROP;
    const clip = shot.crop
      ? { x: size.width / 2 - crop.width / 2, y: size.height / 2 - crop.height / 2, ...crop }
      : undefined;
    await this.page.screenshot({ path: file, clip });
  }

  folder(...parts: string[]): string {
    const target = join(this.outDir, "shots", ...parts);
    mkdirSync(target, { recursive: true });
    return target;
  }

  async sheet(name: string, title: string, headers: string[], rows: SheetRow[], tileHeight = 270): Promise<void> {
    await new ContactSheet(this.sheetPage, tileHeight, 1).write(
      join(this.outDir, `${name}.png`), title, headers, rows,
    );
  }
}
