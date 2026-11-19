import type { Page } from "@playwright/test";
import type { DevHandle } from "../../src/core/devTools";
import type { GameSession } from "./GameSession";
import type { FrameMeasurement } from "./FrameProbe";
import type { Dir, Viewpoint } from "./ViewpointPlanner";

type DevWindow = { nachsitzenDev: DevHandle };

export type RemoteLook = { name: string; avatar: boolean; theme: string | null };

export type RemoteShot = { view: Viewpoint; look: string; distance: number; side: string };

export class RemoteShots {
  static readonly LOOKS: RemoteLook[] = [
    { name: "plain", avatar: false, theme: null },
    { name: "theme-neon", avatar: false, theme: "body_neon" },
    { name: "avatar-theme", avatar: true, theme: "body_schulrot" },
  ];
  static readonly DISTANCES = [2, 8];
  static readonly SIDES = ["front", "side", "back"];

  constructor(private readonly session: GameSession, private readonly page: Page) {}

  private static yawFor(dir: Dir, side: string): number {
    const front = Math.atan2(dir.dx, dir.dz);
    if (side === "front") return front;
    if (side === "back") return front + Math.PI;
    return front + Math.PI / 2;
  }

  async place(botX: number, botZ: number, yaw: number): Promise<void> {
    for (let i = 0; i < 5; i++) {
      await this.session.botSend({ type: "move", x: botX, z: botZ, yaw });
      await this.page.waitForTimeout(150);
    }
    await this.page.waitForTimeout(600);
  }

  async dress(look: RemoteLook): Promise<void> {
    const id = await this.session.botSelfId();
    await this.page.evaluate(([botId, avatar, theme]) => {
      const dev = (window as unknown as DevWindow).nachsitzenDev;
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 64;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "#3c8fd8";
      ctx.fillRect(0, 0, 64, 64);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(10, 14, 14, 14);
      ctx.fillRect(40, 14, 14, 14);
      ctx.fillStyle = "#101010";
      ctx.fillRect(14, 18, 6, 6);
      ctx.fillRect(44, 18, 6, 6);
      ctx.fillStyle = "#ff3030";
      ctx.fillRect(16, 44, 32, 6);
      ctx.fillStyle = "#ffe040";
      ctx.fillRect(0, 0, 12, 6);
      if (avatar) dev.remotes.setAvatar(botId as string, canvas.toDataURL("image/png"));
      dev.remotes.setCosmetic(botId as string, theme ? { body: theme as string } : {});
    }, [id, look.avatar, look.theme] as const);
    await this.page.waitForTimeout(500);
  }

  async addExtras(camX: number, camZ: number, dir: Dir, count: number): Promise<void> {
    await this.page.evaluate(([x, z, dx, dz, n]) => {
      const dev = (window as unknown as DevWindow).nachsitzenDev;
      for (let i = 0; i < (n as number); i++) {
        const side = (i % 2 === 0 ? 1 : -1) * (0.8 + 0.4 * i);
        dev.remotes.add({
          id: `extra${i}`, color: "#a9b4c2", name: `Extra ${i}`,
          x: (x as number) + (dx as number) * 4 - (dz as number) * side,
          z: (z as number) + (dz as number) * 4 + (dx as number) * side, yaw: 0,
        });
      }
    }, [camX, camZ, dir.dx, dir.dz, count] as const);
    await this.page.waitForTimeout(1500);
  }

  async clearExtras(count: number): Promise<void> {
    await this.page.evaluate((n) => {
      const dev = (window as unknown as DevWindow).nachsitzenDev;
      for (let i = 0; i < n; i++) dev.remotes.remove(`extra${i}`);
    }, count);
  }

  shots(camX: number, camZ: number, dir: Dir, clear: number): Array<RemoteShot & { botX: number; botZ: number; yaw: number }> {
    const out: Array<RemoteShot & { botX: number; botZ: number; yaw: number }> = [];
    for (const look of RemoteShots.LOOKS) {
      for (const distance of RemoteShots.DISTANCES) {
        const reach = Math.min(distance, clear);
        const botX = camX + dir.dx * reach;
        const botZ = camZ + dir.dz * reach;
        for (const side of RemoteShots.SIDES) {
          out.push({
            view: {
              name: `remote-${look.name}-${side}-${distance}m`, x: camX, z: camZ,
              lookX: botX, lookZ: botZ, lookY: 1.0, measure: false,
            },
            look: look.name, distance, side, botX, botZ, yaw: RemoteShots.yawFor(dir, side),
          });
        }
      }
    }
    return out;
  }

  static measureSummary(m: FrameMeasurement): string {
    return `draw ${m.drawCalls.median} tris ${Math.round(m.activeTriangles.median)}`;
  }
}
