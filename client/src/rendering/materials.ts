import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import type { Material } from "@babylonjs/core/Materials/material";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { activeScene, basicMaterial, color3, lambertMaterial } from "./babylon";
import { AMBIENCE } from "./ambience";
import { RetroTextureStyle } from "./retroTextureStyle";
import type { RoomArchetype } from "../world/rooms";

function loadPainting(url: string): Texture {
  const tex = RetroTextureStyle.load(url);
  tex.uScale = -1;
  tex.uOffset = 1;
  return tex;
}

function surfaceTexturePath(category: string): string {
  return `/textures/surfaces/${category}/albedo.webp`;
}

function buildSurface(
  name: string, category: string, tint: number, repeat: [number, number],
): StandardMaterial {
  const mat = new StandardMaterial(name, activeScene());
  const tex = RetroTextureStyle.load(surfaceTexturePath(category));
  tex.wrapU = Texture.WRAP_ADDRESSMODE;
  tex.wrapV = Texture.WRAP_ADDRESSMODE;
  tex.uScale = repeat[0];
  tex.vScale = repeat[1];
  mat.diffuseTexture = tex;
  mat.diffuseColor = color3(tint);
  mat.specularColor = Color3.Black();
  mat.maxSimultaneousLights = 1;
  return mat;
}

export type ArchetypeMaterialSet = {
  wall: Material;
  floor: Material;
  ceiling: Material;
  dado?: Material;
  rail?: Material;
};

function buildArchetypeMaterials(archetype: RoomArchetype): ArchetypeMaterialSet {
  const config = AMBIENCE.materials.rooms[archetype];
  const wall = buildSurface(
    `wall_${archetype}`, config.wall, config.wallTint, [config.wallRepeatU, config.wallRepeatV],
  );
  const floor = buildSurface(
    `floor_${archetype}`, config.floor, config.floorTint,
    [config.floorRepeatU, config.floorRepeatV],
  );
  const ceiling = buildSurface(
    `ceiling_${archetype}`, config.ceiling, config.ceilingTint,
    [config.ceilingRepeatU, config.ceilingRepeatV],
  );
  const out: ArchetypeMaterialSet = { wall, floor, ceiling };
  if (config.dado) {
    out.dado = buildSurface(`dado_${archetype}`, config.dado.category, config.dado.tint, [1, 1]);
    const rail = AMBIENCE.materials.dadoRail;
    out.rail = buildSurface(`rail_${archetype}`, rail.category, rail.tint, [1, 1]);
  }
  return out;
}

const archetypeCache = new Map<RoomArchetype, ArchetypeMaterialSet>();

export function getRoomMaterials(archetype: RoomArchetype): ArchetypeMaterialSet {
  let set = archetypeCache.get(archetype);
  if (!set) {
    set = buildArchetypeMaterials(archetype);
    archetypeCache.set(archetype, set);
  }
  return set;
}

const DECAL_Z_OFFSET = -2;
let decalMaterial: StandardMaterial | null = null;

export function getDecalMaterial(): Material {
  if (decalMaterial) return decalMaterial;
  const mat = new StandardMaterial("decal_leak", activeScene());
  const tex = RetroTextureStyle.load(surfaceTexturePath(AMBIENCE.materials.decal.category));
  tex.hasAlpha = true;
  mat.diffuseTexture = tex;
  mat.useAlphaFromDiffuseTexture = true;
  mat.diffuseColor = Color3.White();
  mat.specularColor = Color3.Black();
  mat.backFaceCulling = true;
  mat.alpha = AMBIENCE.materials.decal.alpha;
  mat.zOffset = DECAL_Z_OFFSET;
  mat.maxSimultaneousLights = 1;
  decalMaterial = mat;
  return mat;
}

const PAINTING_FILES: ReadonlyArray<string> = Array.from(
  { length: 24 }, (_, i) => `painting-${String(i + 1).padStart(2, "0")}.webp`,
);

const FLAT = {
  deskWood: 0x7a4a22,
  deskLeg: 0x222227,
  studentDesk: 0xa57a3a,
  whiteboardFrame: 0x2a2a2e,
  whiteboardSurface: 0xeae6d2,
  cupboard: 0x4a3520,
  closet: 0x6f7480,
  trashCan: 0x222226,
  paintingFrame: 0x18120a,
  pot: 0x5a3a2a,
  foliage: 0x356b2d,
  stallPanel: 0x8a9099,
  sink: 0xe6e6e2,
  sinkBasin: 0xbcbcb8,
  faucet: 0x8a8d92,
  toiletPorcelain: 0xeeeee8,
  toiletSeat: 0xd9d9d3,
  bookshelf: 0x3a2614,
  bookA: 0x8a3030,
  bookB: 0x2f4a78,
  bookC: 0x4a6a2a,
  bookD: 0xc8a25a,
  bookE: 0x553a1c,
  clockFace: 0xeae6d2,
  clockRim: 0x18120a,
  globeBall: 0x2a5a8a,
  globeStand: 0x18120a,
  flagRed: 0xc62828,
  flagCross: 0xf5f5f5,
  projector: 0x1a1a1e,
  cork: 0x7a5230,
  noteWhite: 0xeae6d2,
  noteYellow: 0xe8c95a,
  noteBlue: 0x7a9fc8,
  radiator: 0xd0cec5,
  backpack: 0x2a3a4a,
  fireRed: 0xa01818,
  locker: 0x4a5260,
  lockerDoor: 0x3a4250,
  lockerInside: 0x1c2028,
  lampPole: 0x1a1a1e,
  mirror: 0x9fb8c8,
} as const;

const SURFACE_PROPS = {
  doorPanel: { category: "door_wood", tint: 0xffffff, repeat: [1, 1] },
  doorInset: { category: "door_wood", tint: 0xc8a078, repeat: [1, 1] },
  doorFrame: { category: "door_wood", tint: 0xb89c78, repeat: [0.2, 1] },
  stallDoor: { category: "door_stall_metal", tint: 0xe0d8c0, repeat: [1, 1] },
  stallDoorInset: { category: "door_stall_metal", tint: 0xa89c78, repeat: [1, 1] },
} as const;

const EMISSIVE = {
  neon: 0xff4dc4,
  lightFixture: 0xffffcc,
  clockHand: 0x111111,
  projectorLens: 0xffe28a,
  pin: 0xff4d4d,
  lampShade: 0xf3d98a,
} as const;

/** Central palette. PS1-ish: Lambert for surfaces, Basic for emissives. */
export type Materials =
  Record<
    keyof typeof FLAT | keyof typeof EMISSIVE | keyof typeof SURFACE_PROPS,
    StandardMaterial
  >
  & { floor: Material; wall: Material; ceiling: Material }
  & { paintings: StandardMaterial[] };

let cached: Record<string, unknown> | null = null;

function build(): Record<string, unknown> {
  const hallway = getRoomMaterials("hallway");
  const out: Record<string, unknown> = {
    floor: hallway.floor,
    wall: hallway.wall,
    ceiling: hallway.ceiling,
    paintings: PAINTING_FILES.map((f, i) => {
      const mat = new StandardMaterial(`painting${i}`, activeScene());
      mat.diffuseColor = Color3.White();
      mat.specularColor = Color3.Black();
      mat.maxSimultaneousLights = 1;
      mat.diffuseTexture = loadPainting(`/textures/paintings/${f}`);
      return mat;
    }),
  };
  for (const [key, color] of Object.entries(FLAT)) {
    out[key] = lambertMaterial(color, key);
  }
  for (const [key, prop] of Object.entries(SURFACE_PROPS)) {
    out[key] = buildSurface(key, prop.category, prop.tint, [prop.repeat[0], prop.repeat[1]]);
  }
  for (const [key, color] of Object.entries(EMISSIVE)) {
    out[key] = basicMaterial(color, key);
  }
  return out;
}

export const materials = new Proxy({} as Materials, {
  get(_t, prop: string) {
    if (!cached) cached = build();
    return cached[prop];
  },
});
