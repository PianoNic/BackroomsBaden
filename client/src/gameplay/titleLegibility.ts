export class TitleLegibility {
  static readonly MIN_LUMINANCE = 0.82;
  static readonly MAX_LIGHTNESS = 0.92;
  static readonly MIN_SATURATION = 0.55;

  static legible(hex: string): string {
    const [r, g, b] = TitleLegibility.parse(hex);
    const [h, s, l0] = TitleLegibility.toHsl(r, g, b);
    const sat = s < 0.08 ? s : Math.max(s, TitleLegibility.MIN_SATURATION);
    let l = Math.min(l0, TitleLegibility.MAX_LIGHTNESS);
    let out = TitleLegibility.fromHsl(h, sat, l);
    while (TitleLegibility.luminance(out) < TitleLegibility.MIN_LUMINANCE && l < TitleLegibility.MAX_LIGHTNESS) {
      l = Math.min(TitleLegibility.MAX_LIGHTNESS, l + 0.02);
      out = TitleLegibility.fromHsl(h, sat, l);
    }
    return TitleLegibility.format(out);
  }

  static luminance(rgb: readonly [number, number, number]): number;
  static luminance(hex: string): number;
  static luminance(input: string | readonly [number, number, number]): number {
    const [r, g, b] = typeof input === "string" ? TitleLegibility.parse(input) : input;
    const lin = (v: number): number => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  }

  static hue(hex: string): number {
    const [r, g, b] = TitleLegibility.parse(hex);
    return TitleLegibility.toHsl(r, g, b)[0];
  }

  private static parse(hex: string): [number, number, number] {
    let body = hex.replace("#", "");
    if (body.length === 3 || body.length === 4) {
      body = body.split("").map((c) => c + c).join("");
    }
    const n = parseInt(body.slice(0, 6), 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  }

  private static format(rgb: readonly [number, number, number]): string {
    const part = (v: number): string => Math.round(v * 255).toString(16).padStart(2, "0");
    return `#${part(rgb[0])}${part(rgb[1])}${part(rgb[2])}`;
  }

  private static toHsl(r: number, g: number, b: number): [number, number, number] {
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;
    const d = max - min;
    if (d === 0) return [0, 0, l];
    const s = d / (1 - Math.abs(2 * l - 1));
    let h: number;
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    return [(h * 60 + 360) % 360, s, l];
  }

  private static fromHsl(h: number, s: number, l: number): [number, number, number] {
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l - c / 2;
    const sector = Math.floor(h / 60) % 6;
    const table: Array<[number, number, number]> = [
      [c, x, 0], [x, c, 0], [0, c, x], [0, x, c], [x, 0, c], [c, 0, x],
    ];
    const [r, g, b] = table[sector];
    return [r + m, g + m, b + m];
  }
}
