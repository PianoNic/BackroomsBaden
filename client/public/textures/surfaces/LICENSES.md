# Texture Licenses

Every texture in this directory is CC0 1.0 / public domain and requires no attribution to use, modify or redistribute; the tables below are provided for traceability only.

## PSX Textures - 90 Seamless PS1-Style Textures, 5 Looks

By Francisco Cidade, https://fcidade.itch.io/psx-textures-vol-1, licence CC0 1.0 (text in the pack's `LICENSE.txt`). The pack's source materials are ambientCG, also CC0 1.0; the ambientCG material id of each texture is its file name in the pack, as listed in the pack's `CREDITS.txt`.

| Category | Pack texture | Look | ambientCG material | Pack page | Licence | Fetched |
|---|---|---|---|---|---|---|
| `wall_plaster_cream` | C_soft/plaster-paper/Plaster001.png | C_soft (128 px, 32 colours, light dither) | [Plaster001](https://ambientcg.com/a/Plaster001) | https://fcidade.itch.io/psx-textures-vol-1 | CC0 1.0 | 2026-11-19 |
| `wall_plaster_plain` | C_soft/plaster-paper/Plaster003.png | C_soft (128 px, 32 colours, light dither) | [Plaster003](https://ambientcg.com/a/Plaster003) | https://fcidade.itch.io/psx-textures-vol-1 | CC0 1.0 | 2026-11-19 |
| `wall_tile_white` | C_soft/tiles/Tiles036.png | C_soft (128 px, 32 colours, light dither) | [Tiles036](https://ambientcg.com/a/Tiles036) | https://fcidade.itch.io/psx-textures-vol-1 | CC0 1.0 | 2026-11-19 |
| `wall_concrete` | C_soft/concrete-stone/Concrete034.png | C_soft (128 px, 32 colours, light dither) | [Concrete034](https://ambientcg.com/a/Concrete034) | https://fcidade.itch.io/psx-textures-vol-1 | CC0 1.0 | 2026-11-19 |
| `dado_tile_green` | C_soft/tiles/Tiles032.png | C_soft (128 px, 32 colours, light dither) | [Tiles032](https://ambientcg.com/a/Tiles032) | https://fcidade.itch.io/psx-textures-vol-1 | CC0 1.0 | 2026-11-19 |
| `floor_lino` | C_soft/tiles/Tiles040.png | C_soft (128 px, 32 colours, light dither) | [Tiles040](https://ambientcg.com/a/Tiles040) | https://fcidade.itch.io/psx-textures-vol-1 | CC0 1.0 | 2026-11-19 |
| `floor_carpet` | A_classic/carpet-fabric/Carpet016.png | A_classic (64 px, 16 colours, PS1 dither) | [Carpet016](https://ambientcg.com/a/Carpet016) | https://fcidade.itch.io/psx-textures-vol-1 | CC0 1.0 | 2026-11-19 |
| `floor_stone_tile` | C_soft/tiles/Tiles078.png | C_soft (128 px, 32 colours, light dither) | [Tiles078](https://ambientcg.com/a/Tiles078) | https://fcidade.itch.io/psx-textures-vol-1 | CC0 1.0 | 2026-11-19 |
| `floor_terrazzo_dark` | C_soft/tiles/Tiles052.png | C_soft (128 px, 32 colours, light dither) | [Tiles052](https://ambientcg.com/a/Tiles052) | https://fcidade.itch.io/psx-textures-vol-1 | CC0 1.0 | 2026-11-19 |
| `floor_wood` | C_soft/wood/WoodFloor040.png | C_soft (128 px, 32 colours, light dither) | [WoodFloor040](https://ambientcg.com/a/WoodFloor040) | https://fcidade.itch.io/psx-textures-vol-1 | CC0 1.0 | 2026-11-19 |
| `ceiling_tile` | C_soft/roofs-ceilings/OfficeCeiling001.png | C_soft (128 px, 32 colours, light dither) | [OfficeCeiling001](https://ambientcg.com/a/OfficeCeiling001) | https://fcidade.itch.io/psx-textures-vol-1 | CC0 1.0 | 2026-11-19 |
| `ceiling_plaster` | C_soft/plaster-paper/Plaster001.png | C_soft (128 px, 32 colours, light dither) | [Plaster001](https://ambientcg.com/a/Plaster001) | https://fcidade.itch.io/psx-textures-vol-1 | CC0 1.0 | 2026-11-19 |
| `door_wood` | C_soft/wood/Wood058.png | C_soft (128 px, 32 colours, light dither) | [Wood058](https://ambientcg.com/a/Wood058) | https://fcidade.itch.io/psx-textures-vol-1 | CC0 1.0 | 2026-11-19 |
| `door_stall_metal` | C_soft/metal/Metal012.png | C_soft (128 px, 32 colours, light dither) | [Metal012](https://ambientcg.com/a/Metal012) | https://fcidade.itch.io/psx-textures-vol-1 | CC0 1.0 | 2026-11-19 |

## ambientCG fallbacks

The pack has no suitable texture for these categories, so they come straight from ambientCG (1K download) and are reduced to the pack's look: downscaled to 128 px, 32 colours, 4x4 ordered dither, decal alpha posterised to 4 levels.

| Category | ambientCG material | Source URL | Source | Licence | Fetched |
|---|---|---|---|---|---|
| `wall_tile_hex` | Tiles071 | https://ambientcg.com/view?id=Tiles071 | ambientCG | CC0 1.0 | 2026-11-19 |
| `decal_leak` | Leaking005 | https://ambientcg.com/view?id=Leaking005 | ambientCG | CC0 1.0 | 2026-11-19 |

## File layout

Each category directory holds a single `albedo.webp` (lossless WebP, RGBA for `decal_leak`, RGB for the rest). Pack textures are copied through unchanged.

Run `tools/fetch_textures.py` to regenerate this entire tree.
