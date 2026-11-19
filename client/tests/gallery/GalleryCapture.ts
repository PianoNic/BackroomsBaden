import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Page } from "@playwright/test";
import type { CatalogItem, EquippedCosmetics } from "../../src/net/protocol";
import type { GalleryApi } from "./GalleryApp";
import { ContactSheet, type SheetRow } from "./ContactSheet";
import { GalleryPlan, type CameraShot } from "./GalleryPlan";

type Kind = "Remote" | "Corpse";

export class GalleryCapture {
  private readonly shots: string;
  private readonly only: Set<string> | null;
  private readonly items: Set<string> | null;
  private readonly bounds: Record<string, unknown> = {};

  constructor(
    private readonly page: Page,
    private readonly sheetPage: Page,
    private readonly plan: GalleryPlan,
    private readonly outDir: string,
  ) {
    this.shots = join(outDir, "shots");
    this.only = GalleryCapture.parse(process.env.GALLERY_ONLY);
    this.items = GalleryCapture.parse(process.env.GALLERY_ITEMS);
  }

  private static parse(value: string | undefined): Set<string> | null {
    return value ? new Set(value.split(",")) : null;
  }

  private wants(category: string): boolean {
    return !this.only || this.only.has(category);
  }

  private pick(items: CatalogItem[]): CatalogItem[] {
    return this.items ? items.filter((it) => this.items!.has(it.id)) : items;
  }

  private dir(...parts: string[]): string {
    const target = join(this.shots, ...parts);
    mkdirSync(target, { recursive: true });
    return target;
  }

  private frames(count = 3): Promise<void> {
    return this.page.evaluate(
      (n) => (window as unknown as { cosmeticGallery: GalleryApi }).cosmeticGallery.frames(n),
      count,
    );
  }

  private async resize(width: number, height: number): Promise<void> {
    await this.page.setViewportSize({ width, height });
    await this.frames();
  }

  private async show(kind: Kind, equipped: EquippedCosmetics): Promise<void> {
    const look = kind === "Remote" ? { ...equipped, title: GalleryPlan.TITLE } : equipped;
    await this.page.evaluate(
      async ([method, eq]) => {
        const api = (window as unknown as { cosmeticGallery: GalleryApi }).cosmeticGallery;
        if (method === "Remote") await api.showRemote(eq as EquippedCosmetics);
        else await api.showCorpse(eq as EquippedCosmetics);
      },
      [kind, look] as const,
    );
  }

  private async showHand(equipped: EquippedCosmetics, eyeHeight: number): Promise<void> {
    await this.page.evaluate(
      ([eq, eye]) => (window as unknown as { cosmeticGallery: GalleryApi })
        .cosmeticGallery.showHand(eq as EquippedCosmetics, eye as number),
      [equipped, eyeHeight] as const,
    );
  }

  private eyeHeights(): Promise<Array<[string, number]>> {
    return this.page.evaluate(() => {
      const heights = (window as unknown as { cosmeticGallery: GalleryApi }).cosmeticGallery.eyeHeights;
      return [["stand", heights.standing], ["crouch", heights.crouching]] as Array<[string, number]>;
    });
  }

  private async capture(shot: CameraShot, file: string): Promise<void> {
    await this.page.evaluate(
      ([position, target]) => (window as unknown as { cosmeticGallery: GalleryApi })
        .cosmeticGallery.setCamera(position, target),
      [shot.position, shot.target] as const,
    );
    await this.frames();
    const size = this.page.viewportSize()!;
    const clip = shot.crop
      ? { x: size.width / 2 - 240, y: size.height / 2 - 135, width: 480, height: 270 }
      : undefined;
    await this.page.screenshot({ path: file, clip });
  }

  private async sweep(
    category: string, subject: string, equipped: EquippedCosmetics, shots: CameraShot[], kind: Kind,
  ): Promise<string[]> {
    await this.show(kind, equipped);
    if (kind === "Remote") {
      this.bounds[subject] = await this.page.evaluate(
        () => (window as unknown as { cosmeticGallery: GalleryApi }).cosmeticGallery.bounds(),
      );
    }
    const folder = this.dir(category, subject);
    const files: string[] = [];
    for (const shot of shots) {
      const file = join(folder, `${shot.name}.png`);
      await this.capture(shot, file);
      files.push(file);
    }
    return files;
  }

  private async sheet(
    name: string, title: string, headers: string[], rows: SheetRow[], tileHeight = 180, zoom = 1,
  ): Promise<void> {
    await new ContactSheet(this.sheetPage, tileHeight, zoom).write(
      join(this.outDir, `${name}.png`), title, headers, rows,
    );
  }

  private async itemRows(
    category: string, items: CatalogItem[], shots: CameraShot[], kind: Kind,
  ): Promise<SheetRow[]> {
    const rows: SheetRow[] = [];
    for (const item of items) {
      const files = await this.sweep(category, item.id, { [item.category]: item.id }, shots, kind);
      rows.push({ label: item.id, files });
    }
    return rows;
  }

  private async comboRows(category: string, shots: CameraShot[], kind: Kind): Promise<SheetRow[]> {
    const rows: SheetRow[] = [];
    for (const combo of this.plan.comboLoadouts()) {
      const files = await this.sweep(category, combo.name, combo.equipped, shots, kind);
      rows.push({ label: combo.name, files });
    }
    return rows;
  }

  async remote(): Promise<void> {
    if (!this.wants("remote")) return;
    await this.resize(1280, 720);
    const groups: Array<[string, CatalogItem[]]> = [
      ["backpack", this.pick(this.plan.category("backpack"))],
      ["mask", this.pick(this.plan.category("mask"))],
      ["hat-model", this.pick(this.plan.hats().filter((h) => this.plan.isModel(h)))],
    ];
    for (const distance of GalleryPlan.DISTANCES) {
      for (const [name, items] of groups) {
        const shots = this.plan.remoteShots(
          distance, name === "backpack" ? GalleryPlan.BODY_FOCUS : GalleryPlan.TAG_FOCUS,
        );
        const rows = await this.itemRows("remote", items, shots, "Remote");
        await this.sheet(
          `sheet_remote_${name}_${distance}m`, `remote ${name} ${distance}m`,
          shots.map((s) => s.name), rows, 230, distance < 4 && name === "backpack" ? 1.8 : 1,
        );
      }
    }
    const front = this.plan.remoteShots(2, GalleryPlan.TAG_FOCUS).slice(0, 1);
    const procedural = this.pick(this.plan.hats().filter((h) => !this.plan.isModel(h)));
    await this.sheet(
      "sheet_remote_hat-procedural", "remote procedural hats front 2m", ["front_2m"],
      await this.itemRows("remote", procedural, front, "Remote"),
    );
    const comboShots = this.plan.remoteShots(2, GalleryPlan.TAG_FOCUS).slice(0, 4);
    writeFileSync(join(this.outDir, "bounds.json"), JSON.stringify(this.bounds, null, 1));
    await this.sheet(
      "sheet_remote_combos_2m", "remote combined loadouts 2m",
      comboShots.map((s) => s.name), await this.comboRows("remote-combo", comboShots, "Remote"), 230, 1,
    );
  }

  async corpses(): Promise<void> {
    if (!this.wants("corpse")) return;
    await this.resize(1280, 720);
    const shots = this.plan.corpseShots();
    const headers = shots.map((s) => s.name);
    const groups: Array<[string, CatalogItem[]]> = [
      ["backpack", this.pick(this.plan.category("backpack"))],
      ["mask", this.pick(this.plan.category("mask"))],
      ["hat", this.pick(this.plan.hats())],
    ];
    for (const [name, items] of groups) {
      await this.sheet(
        `sheet_corpse_${name}`, `corpse ${name}`, headers,
        await this.itemRows("corpse", items, shots, "Corpse"),
      );
    }
    await this.sheet(
      "sheet_corpse_combos", "corpse combined loadouts", headers,
      await this.comboRows("corpse-combo", shots, "Corpse"),
    );
  }

  async hands(): Promise<void> {
    if (!this.wants("hand")) return;
    const items = this.pick(this.plan.category("handitem"));
    const subjects: Array<{ id: string; equipped: EquippedCosmetics }> = [
      { id: "handitem_stuhl", equipped: {} },
      ...items.map((it) => ({ id: it.id, equipped: { handitem: it.id } })),
    ];
    for (const [stance, eyeHeight] of await this.eyeHeights()) {
      for (const viewport of GalleryPlan.HAND_VIEWPORTS) {
        await this.resize(viewport.width, viewport.height);
        const files: string[] = [];
        for (const subject of subjects) {
          await this.showHand(subject.equipped, eyeHeight);
          await this.frames();
          const file = join(this.dir("hand", subject.id), `${viewport.name}_${stance}.png`);
          await this.page.screenshot({ path: file });
          files.push(file);
        }
        await this.sheet(
          `sheet_hand_${viewport.name}_${stance}`,
          `first person ${viewport.name} ${viewport.width}x${viewport.height} ${stance} eye ${eyeHeight}`,
          subjects.map((s) => s.id), [{ label: `${viewport.name} ${stance}`, files }], viewport.sheetHeight,
        );
      }
    }
  }
}
