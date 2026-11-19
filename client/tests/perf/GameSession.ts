import type { BrowserContext, Page } from "@playwright/test";
import type { PickupKind, WorldInit } from "../../src/net/protocol";
import { PerfEnvironment } from "./PerfEnvironment";
import { PointerLockGuard } from "./PointerLockGuard";

export class GameSession {
  private main!: Page;
  private bot!: Page;
  private botContext!: BrowserContext;
  private lobbyId = "";

  constructor(private readonly context: BrowserContext) {}

  get page(): Page {
    return this.main;
  }

  async start(): Promise<WorldInit> {
    await PointerLockGuard.install(this.context);
    const created = await this.context.request.post("/lobbies", {
      data: { name: "perf", maxPlayers: 8 },
    });
    this.lobbyId = ((await created.json()) as { id: string }).id;
    await this.openMain();
    await this.openBot();
    await this.main.evaluate(
      ({ size, seed }) => {
        const socket = (window as unknown as { __sockets: WebSocket[] }).__sockets[0];
        socket.send(JSON.stringify({ type: "lobby_settings", mapSize: size, mapSeed: seed }));
      },
      { size: PerfEnvironment.MAP_SIZE, seed: PerfEnvironment.SEED },
    );
    await this.main.waitForTimeout(500);
    await this.main.evaluate(() => {
      const socket = (window as unknown as { __sockets: WebSocket[] }).__sockets[0];
      socket.send(JSON.stringify({ type: "start_game" }));
    });
    await this.main.waitForFunction(
      () => (window as unknown as { nachsitzenDev?: unknown }).nachsitzenDev !== undefined,
      undefined,
      { timeout: 300_000 },
    );
    return this.main.evaluate(
      () => (window as unknown as { nachsitzenDev: { init: unknown } }).nachsitzenDev.init,
    ) as Promise<WorldInit>;
  }

  async close(): Promise<void> {
    await this.botContext?.close();
  }

  async parkMain(x: number, z: number): Promise<void> {
    await this.main.evaluate(({ px, pz }) => {
      const socket = (window as unknown as { __sockets: { rawSend(d: string): void }[] }).__sockets[0];
      socket.rawSend(JSON.stringify({ type: "move", x: px, z: pz, yaw: 0 }));
    }, { px: x, pz: z });
  }

  async openLocker(lockerId: string, x: number, z: number): Promise<void> {
    await this.parkMain(x, z);
    await this.main.waitForTimeout(250);
    await this.main.evaluate((id) => {
      const socket = (window as unknown as { __sockets: { rawSend(d: string): void }[] }).__sockets[0];
      socket.rawSend(JSON.stringify({ type: "locker_open", lockerId: id }));
    }, lockerId);
    await this.main.waitForTimeout(250);
    await this.parkMain(-1000, -1000);
  }

  async spawnedPickups(): Promise<{ kind: PickupKind; x: number; z: number }[]> {
    return this.main.evaluate(
      () => (window as unknown as { __spawned: { kind: PickupKind; x: number; z: number }[] }).__spawned,
    );
  }

  async botSend(packet: Record<string, unknown>): Promise<void> {
    await this.bot.evaluate((pkt) => {
      (window as unknown as { __bot: WebSocket }).__bot.send(JSON.stringify(pkt));
    }, packet);
  }

  async botKilled(): Promise<{ x: number; z: number } | null> {
    return this.bot.evaluate(
      () => (window as unknown as { __botKilled: { x: number; z: number } | null }).__botKilled,
    );
  }

  async botSelfId(): Promise<string> {
    return this.bot.evaluate(
      () => (window as unknown as { __botSelf: string }).__botSelf,
    );
  }

  private async openMain(): Promise<void> {
    this.main = await this.context.newPage();
    await this.main.addInitScript(
      (lobbyId) => {
        sessionStorage.setItem("nachsitzen-intro-seen", "1");
        sessionStorage.setItem("nachsitzen_lobby_resume", JSON.stringify({ lobbyId }));
        const Native = window.WebSocket;
        const sockets: WebSocket[] = [];
        (window as unknown as { __spawned: unknown[] }).__spawned = [];
        (window as unknown as { __sockets: WebSocket[] }).__sockets = sockets;
        window.WebSocket = class extends Native {
          constructor(url: string | URL, protocols?: string | string[]) {
            super(url, protocols);
            sockets.push(this);
            this.addEventListener("message", (ev) => {
              const pkt = JSON.parse(ev.data as string) as {
                type: string;
                spawned?: { kind: string; x: number; z: number } | null;
              };
              if (pkt.type === "locker_opened" && pkt.spawned) {
                (window as unknown as { __spawned: unknown[] }).__spawned.push(pkt.spawned);
              }
            });
          }

          send(data: string | ArrayBufferLike | Blob | ArrayBufferView): void {
            if (typeof data === "string" && data.includes('"type":"move"')) return;
            super.send(data);
          }

          rawSend(data: string): void {
            super.send(data);
          }
        } as typeof WebSocket;
      },
      this.lobbyId,
    );
    await this.main.goto("/");
    await this.main.waitForFunction(
      () => (window as unknown as { __sockets?: WebSocket[] }).__sockets?.[0]?.readyState === 1,
      undefined,
      { timeout: 60_000 },
    );
    await this.main.waitForTimeout(1500);
  }

  private async openBot(): Promise<void> {
    this.botContext = await this.context.browser()!.newContext();
    this.bot = await this.botContext.newPage();
    await this.bot.goto("/healthz");
    await this.bot.evaluate((lobbyId) => {
      const w = window as unknown as {
        __bot: WebSocket; __botKilled: { x: number; z: number } | null; __botSelf: string;
      };
      w.__botKilled = null;
      const proto = location.protocol === "https:" ? "wss" : "ws";
      w.__bot = new WebSocket(`${proto}://${location.host}/ws/${lobbyId}`);
      w.__bot.addEventListener("message", (ev) => {
        const pkt = JSON.parse(ev.data) as { type: string; id?: string; selfId?: string; x?: number; z?: number };
        if (pkt.type === "lobby_state" && pkt.selfId) w.__botSelf = pkt.selfId;
        if (pkt.type === "player_killed" && pkt.id === w.__botSelf) {
          w.__botKilled = { x: pkt.x as number, z: pkt.z as number };
        }
      });
    }, this.lobbyId);
    await this.bot.waitForFunction(
      () => (window as unknown as { __bot: WebSocket }).__bot.readyState === 1,
      undefined,
      { timeout: 30_000 },
    );
    await this.bot.waitForTimeout(500);
  }
}
