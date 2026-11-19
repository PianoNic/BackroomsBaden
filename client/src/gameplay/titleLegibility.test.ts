import { describe, expect, it } from "vitest";
import { TitleLegibility } from "./titleLegibility";

const CATALOG_COLORS = [
  "#c9a227", "#1e5aa8", "#0066ff", "#ff0000", "#00aa00", "#8a2be2", "#b8860b", "#a0522d", "#ff8c00", "#00bfff",
];

describe("TitleLegibility", () => {
  it.each(CATALOG_COLORS)("lifts %s to a readable luminance", (hex) => {
    expect(TitleLegibility.luminance(TitleLegibility.legible(hex))).toBeGreaterThanOrEqual(0.6);
  });

  it.each(CATALOG_COLORS)("keeps the hue of %s", (hex) => {
    const diff = Math.abs(TitleLegibility.hue(TitleLegibility.legible(hex)) - TitleLegibility.hue(hex));
    expect(Math.min(diff, 360 - diff)).toBeLessThan(8);
  });

  it("lifts the dull dark gold clearly above its original brightness", () => {
    const lifted = TitleLegibility.luminance(TitleLegibility.legible("#c9a227"));
    expect(lifted).toBeGreaterThan(TitleLegibility.luminance("#c9a227") * 1.15);
  });

  it("keeps even a white title dimmer than a white name", () => {
    expect(TitleLegibility.luminance(TitleLegibility.legible("#ffffff"))).toBeLessThan(0.95);
  });

  it("leaves colours that are already bright almost untouched", () => {
    const bright = "#ffe066";
    expect(TitleLegibility.legible(bright)).toBe(bright);
  });
});
