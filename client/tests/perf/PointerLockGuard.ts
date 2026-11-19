import type { BrowserContext } from "@playwright/test";

export class PointerLockGuard {
  static async install(context: BrowserContext): Promise<void> {
    await context.addInitScript(() => {
      let locked: Element | null = null;
      const notify = (): void => {
        setTimeout(() => document.dispatchEvent(new Event("pointerlockchange")), 0);
      };
      Element.prototype.requestPointerLock = function (this: Element) {
        locked = this;
        notify();
        return Promise.resolve();
      } as unknown as typeof Element.prototype.requestPointerLock;
      Object.defineProperty(Document.prototype, "pointerLockElement", {
        configurable: true,
        get: () => locked,
      });
      document.exitPointerLock = () => {
        locked = null;
        notify();
      };
    });
  }
}
