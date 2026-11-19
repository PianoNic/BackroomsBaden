import type { Page } from "@playwright/test";

export class PixelDiff {
  constructor(private readonly page: Page) {}

  async count(a: Buffer, b: Buffer, threshold = 30): Promise<number> {
    return this.page.evaluate(
      async ([first, second, limit]) => {
        const load = (data: string): Promise<ImageData> => new Promise((resolve) => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement("canvas");
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext("2d")!;
            ctx.drawImage(img, 0, 0);
            resolve(ctx.getImageData(0, 0, img.width, img.height));
          };
          img.src = `data:image/png;base64,${data}`;
        });
        const [x, y] = await Promise.all([load(first), load(second)]);
        let differing = 0;
        for (let i = 0; i < x.data.length; i += 4) {
          const delta = Math.max(
            Math.abs(x.data[i] - y.data[i]),
            Math.abs(x.data[i + 1] - y.data[i + 1]),
            Math.abs(x.data[i + 2] - y.data[i + 2]),
          );
          if (delta > (limit as number)) differing += 1;
        }
        return differing;
      },
      [a.toString("base64"), b.toString("base64"), threshold] as const,
    );
  }
}
