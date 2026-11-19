import { test as base, expect, type BrowserContext } from "@playwright/test";

export class PointerLockStub {
  static async install(context: BrowserContext): Promise<void> {
    await context.addInitScript(() => {
      let locked: Element | null = null;
      const notify = (): void => {
        queueMicrotask(() => document.dispatchEvent(new Event("pointerlockchange")));
      };
      Object.defineProperty(Document.prototype, "pointerLockElement", {
        configurable: true,
        get: () => locked,
      });
      Element.prototype.requestPointerLock = function (this: Element) {
        locked = this;
        notify();
        return Promise.resolve();
      };
      document.exitPointerLock = (): void => {
        if (!locked) return;
        locked = null;
        notify();
      };
    });
  }
}

export const test = base.extend({
  context: async ({ context }, use) => {
    await PointerLockStub.install(context);
    await use(context);
  },
});

export { expect };
