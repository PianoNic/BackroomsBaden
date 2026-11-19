import type { CatalogItem, CosmeticCategory } from "../../../net/protocol";

export class ShopCatalogView {
  private static readonly ACHIEVEMENT_NAMES: Record<string, string> = {
    ach_erste_schicht: "Erste Schicht",
    ach_houdini: "Houdini",
    ach_survivor: "Überlebenskünstler",
    ach_sammler: "Sammlerherz",
    ach_medic: "Schulsanitäter",
    ach_streber: "Streber",
    ach_stuhlgewitter: "Stuhlgewitter",
    ach_speedrun: "Speedrunner",
    ach_klassenerhalt: "Klassenerhalt",
  };

  static inCategory(items: CatalogItem[], category: CosmeticCategory): CatalogItem[] {
    return items.filter((item) => item.category === category);
  }

  static featured(items: CatalogItem[]): CatalogItem[] {
    return items.filter((item) => item.featured === true && !item.default && !item.unlock);
  }

  static isLocked(item: CatalogItem, owned: Set<string>): boolean {
    return !!item.unlock && !owned.has(item.id);
  }

  static achievementName(achievementId: string): string {
    return ShopCatalogView.ACHIEVEMENT_NAMES[achievementId] ?? achievementId;
  }

  static lockedLabel(item: CatalogItem): string {
    return item.unlock ? `Unlocked by achievement ${ShopCatalogView.achievementName(item.unlock)}` : "";
  }
}
