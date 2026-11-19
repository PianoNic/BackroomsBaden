import type { FreeCamera } from "@babylonjs/core/Cameras/freeCamera";
import type { WorldInit } from "../net/protocol";
import type { Player } from "../gameplay/player";
import type { Pickups } from "../gameplay/pickups";

export type DevHandle = {
  init: WorldInit;
  player: Player;
  pickups: Pickups;
  camera: FreeCamera;
  teacherPositions: () => { x: number; z: number }[];
  inspector: (on: boolean) => void;
};

export function installDevTools(handle: DevHandle): void {
  if (!import.meta.env.DEV && import.meta.env.VITE_DEV_HOOKS !== "1") return;
  (window as unknown as { nachsitzenDev?: DevHandle }).nachsitzenDev = handle;
}
