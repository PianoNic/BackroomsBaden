import type { RoomArchetype } from "../world/rooms";

export const AMBIENCE = {
  tone: {
    exposure: 1.2,
    contrast: 1.1,
    saturation: 62,
    shadowsHue: 150,
    shadowsDensity: 34,
    midtonesHue: 165,
    midtonesDensity: 12,
    highlightsHue: 195,
    highlightsDensity: 16,
  },
  vignette: {
    weight: 1.9,
    stretch: 0.35,
    color: 0x05060a,
    breathHz: 0.08,
    breathAmount: 0.5,
    chaseWeight: 4.6,
  },
  fog: {
    color: 0x11150e,
    start: 6,
    end: 28,
    breathHz: 0.05,
    breathAmount: 1.2,
    chaseEnd: 20,
    lerp: 1.6,
  },
  ambientLight: {
    skyColor: 0xddd9c2,
    groundColor: 0x8d8974,
    intensity: 1.0,
    minFactor: 0.14,
    radius: 12,
    lerp: 5,
  },
  clearColor: 0x090b08,
  chase: {
    radius: 16,
    exitRadius: 22,
  },
  tube: {
    color: 0xfff2cf,
    emissiveFloor: 0.05,
    blackoutChancePerSecond: 0.01,
    blackoutMinS: 1.0,
    blackoutMaxS: 3.0,
    blackoutRadius: 14,
  },
  cues: {
    heartPulseAmount: 0.09,
    heartPulseHzNear: 2.6,
    heartPulseHzFar: 0.9,
    hiddenSaturation: -72,
    hiddenVignette: 8.5,
    hiddenLerp: 3.5,
    caughtFlashMs: 90,
    caughtBlackMs: 320,
    shakeDecay: 7,
    shakeMax: 0.055,
    shakeChair: 0.045,
    shakeThrow: 0.018,
    shakeRadius: 18,
    swayAmount: 0.006,
    swayHz: 0.55,
    breathAmount: 0.004,
    breathHz: 0.22,
  },
  audio: {
    humHz: 118,
    humDetuneHz: 0.6,
    humGain: 0.045,
    humFlickerGain: 0.09,
    droneHz: 44,
    droneGain: 0.075,
    droneStartDistance: 24,
    farMinS: 30,
    farMaxS: 90,
    farMinDistance: 15,
    farMaxDistance: 30,
  },
  materials: {
    dadoRail: {
      category: "floor_wood",
      tint: 0x6b6d8b,
    },
    decal: {
      category: "decal_leak",
      perRoom: 3,
      minScale: 0.6,
      maxScale: 1.4,
      alpha: 0.55,
    },
    rooms: {
      classroom: {
        wall: "wall_plaster_cream", wallTint: 0xfff5cf,
        wallRepeatU: 1, wallRepeatV: 1.5,
        dado: { category: "dado_tile_green", tint: 0x89b394 },
        dadoHeight: 1.0,
        floor: "floor_lino", floorTint: 0xa59770,
        floorRepeatU: 1, floorRepeatV: 1,
        ceiling: "ceiling_tile", ceilingTint: 0x847d5a,
        ceilingRepeatU: 1, ceilingRepeatV: 1,
      },
      hallway: {
        wall: "wall_plaster_cream", wallTint: 0xfaeec8,
        wallRepeatU: 1, wallRepeatV: 1.5,
        dado: { category: "dado_tile_green", tint: 0x89b394 },
        dadoHeight: 1.0,
        floor: "floor_lino", floorTint: 0xc3cfc0,
        floorRepeatU: 1, floorRepeatV: 1,
        ceiling: "ceiling_tile", ceilingTint: 0x847d5a,
        ceilingRepeatU: 1, ceilingRepeatV: 1,
      },
      toilet: {
        wall: "wall_tile_white", wallTint: 0xd2dace,
        wallRepeatU: 1, wallRepeatV: 1.5,
        dado: { category: "dado_tile_green", tint: 0x89b394 },
        dadoHeight: 1.0,
        floor: "floor_lino", floorTint: 0xa29376,
        floorRepeatU: 1, floorRepeatV: 1,
        ceiling: "ceiling_plaster", ceilingTint: 0xefeee0,
        ceilingRepeatU: 1, ceilingRepeatV: 1,
      },
      cafeteria: {
        wall: "wall_plaster_plain", wallTint: 0xe7e9da,
        wallRepeatU: 1, wallRepeatV: 1.5,
        floor: "floor_stone_tile", floorTint: 0xf4ffff,
        floorRepeatU: 1, floorRepeatV: 1,
        ceiling: "ceiling_tile", ceilingTint: 0x847d5a,
        ceilingRepeatU: 1, ceilingRepeatV: 1,
      },
      chemistry_lab: {
        wall: "wall_tile_hex", wallTint: 0x878a86,
        wallRepeatU: 1, wallRepeatV: 1.5,
        floor: "floor_terrazzo_dark", floorTint: 0xffffff,
        floorRepeatU: 1, floorRepeatV: 1,
        ceiling: "ceiling_tile", ceilingTint: 0x7f7c62,
        ceilingRepeatU: 1, ceilingRepeatV: 1,
      },
      gym: {
        wall: "wall_plaster_plain", wallTint: 0xd9d6bc,
        wallRepeatU: 1, wallRepeatV: 1.5,
        floor: "floor_wood", floorTint: 0x9397b2,
        floorRepeatU: 1, floorRepeatV: 1,
        ceiling: "ceiling_plaster", ceilingTint: 0xe5ebde,
        ceilingRepeatU: 1, ceilingRepeatV: 1,
      },
      janitor_room: {
        wall: "wall_concrete", wallTint: 0x92958f,
        wallRepeatU: 1, wallRepeatV: 1.5,
        floor: "wall_concrete", floorTint: 0x828680,
        floorRepeatU: 1, floorRepeatV: 1,
        ceiling: "ceiling_plaster", ceilingTint: 0xcacbbf,
        ceilingRepeatU: 1, ceilingRepeatV: 1,
      },
      server_room: {
        wall: "wall_concrete", wallTint: 0x9fabb1,
        wallRepeatU: 1, wallRepeatV: 1.5,
        floor: "floor_lino", floorTint: 0x707372,
        floorRepeatU: 1, floorRepeatV: 1,
        ceiling: "ceiling_plaster", ceilingTint: 0xc0c9ce,
        ceilingRepeatU: 1, ceilingRepeatV: 1,
      },
      teacher_room: {
        wall: "wall_plaster_cream", wallTint: 0xfffacf,
        wallRepeatU: 1, wallRepeatV: 1.5,
        floor: "floor_carpet", floorTint: 0x463b22,
        floorRepeatU: 1, floorRepeatV: 1,
        ceiling: "ceiling_tile", ceilingTint: 0x827b58,
        ceilingRepeatU: 1, ceilingRepeatV: 1,
      },
    } as Record<RoomArchetype, RoomMaterialConfig>,
  },
};

export type DadoConfig = { category: string; tint: number };

export type RoomMaterialConfig = {
  wall: string;
  wallTint: number;
  wallRepeatU: number;
  wallRepeatV: number;
  dado?: DadoConfig;
  dadoHeight?: number;
  floor: string;
  floorTint: number;
  floorRepeatU: number;
  floorRepeatV: number;
  ceiling: string;
  ceilingTint: number;
  ceilingRepeatU: number;
  ceilingRepeatV: number;
};
