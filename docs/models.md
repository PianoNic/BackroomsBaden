# Models

Props and pickups that used to be procedural boxes are glTF models. Most are
low-poly PS1/PS2-style CC0 models from itch.io and OpenGameArt packs; the few
left from Poly Haven are photo scans that get cut down to a retro look at fetch
time (256 px textures, nearest sampling, no PBR maps). The procedural builders in
`propBuilders/*.ts` remain for prop types with no model.

## What is a model

Every model is CC0 1.0 - no attribution is legally required -
[`client/public/models/LICENSES.md`](../client/public/models/LICENSES.md)
credits every author and quotes each pack's licence statement anyway.
Measured size is along x out x height in metres after scaling.

| Prop type | Source | Triangles | Size |
|---|---|---|---|
| `bench` | Poly Haven / painted_wooden_bench | 630 | 1.16 x 0.50 x 0.89 |
| `books_pile` | PSX style office pack / `OFFICE/book_things/books_alt.glb` | 130 | 0.31 x 0.18 x 0.29 |
| `bookshelf` | PSX style office pack / `OFFICE/book_things/book_case_small.glb` | 224 | 0.83 x 0.41 x 2.08 |
| `bunsen_burner` | Poly Haven / bunsen_burner | 2,108 | 0.14 x 0.14 x 0.17 |
| `cafeteria_table` | Poly Haven / dining_table | 1,048 | 2.26 x 1.39 x 0.88 |
| `chair` | PSX Derelict Furniture (Standard) / `PSX-Derelict-Furniture-Standard/glb/chair.glb` | 348 | 0.50 x 0.50 x 1.03 |
| `clock` | PSX style office pack / `OFFICE/extras/wall_clock.glb` | 60 | 0.32 x 0.02 x 0.32 |
| `cupboard` | PSX style office pack / `OFFICE/file_cabinets/file_cabinet_largest.glb` | 20 | 1.12 x 0.55 x 1.10 |
| `desk` | PSX style office pack / `OFFICE/desks/desk2_weathered.glb` | 236 | 1.94 x 0.96 x 0.78 |
| `fire_extinguisher` | Fire Extinguisher / `fire_extinguisher_model.obj` | 330 | 0.50 x 0.14 x 0.48 |
| `fridge` | PSX Derelict Furniture (Standard) / `PSX-Derelict-Furniture-Standard/glb/fridge.glb` | 12 | 0.71 x 0.83 x 1.61 |
| `laptop` | Poly Haven / classic_laptop | 4,532 | 0.36 x 0.27 x 0.30 |
| `locker` | Poly Haven / painted_wooden_cabinet_02 | 966 | 0.50 x 0.40 x 1.80 |
| `microscope` | Poly Haven / industrial_microscope | 4,795 | 0.20 x 0.47 x 0.44 |
| `microwave` | Poly Haven / vintage_microwave | 2,435 | 0.70 x 0.48 x 0.34 |
| `mop_bucket` | Lowpoly survival item pack / `Survival items/items.fbx` | 320 | 0.36 x 0.41 x 0.56 |
| `papers` | PSX style office pack / `OFFICE/stationary/paper_stack.glb` | 12 | 0.33 x 0.44 x 0.03 |
| `plant` | PSX Derelict Furniture (Standard) / `PSX-Derelict-Furniture-Standard/glb/vase.glb` | 242 | 0.67 x 0.83 x 0.63 |
| `pylon` | Poly Haven / WetFloorSign_01 | 228 | 0.30 x 0.36 x 0.63 |
| `recycle_bin` | Poly Haven / plastic_crate_02 | 1,336 | 0.48 x 0.39 x 0.24 |
| `side_table` | PSX style office pack / `OFFICE/file_cabinets/file_cabinet_smallest.glb` | 20 | 0.48 x 0.52 x 0.71 |
| `sofa` | PSX Derelict Furniture (Standard) / `PSX-Derelict-Furniture-Standard/glb/couch.glb` | 178 | 1.60 x 0.91 x 0.85 |
| `student_desk` | Poly Haven / SchoolDesk_01 | 2,080 | 0.71 x 0.55 x 0.88 |
| `trash_can` | Poly Haven / industrial_pastic_container | 713 | 0.34 x 0.47 x 0.31 |
| `vending_machine` | PSX style office pack / `OFFICE/extras/coffee_machine.glb` | 244 | 1.00 x 1.03 x 1.70 |
| `water_dispenser` | PSX style office pack / `OFFICE/extras/water_cooler.glb` | 256 | 0.38 x 0.45 x 1.40 |

### Pickups

| Pickup kind | Source | Triangles | Size |
|---|---|---|---|
| `compass` | Lowpoly survival item pack / `Survival items/items.fbx` | 280 | 0.16 x 0.16 x 0.04 |
| `goggles` | Gas Mask / `gasmask/gasmask.fbx` | 2,115 | 0.14 x 0.27 x 0.23 |
| `gps` | Poly Haven / digital_wrist_watch | 2,632 | 0.04 x 0.26 x 0.01 |
| `medkit` | First Aid Kit 3D / `FirstAid.obj` | 140 | 0.38 x 0.11 x 0.33 |
| `potion` | N64 Potions / `N64 Potions/GLB/Red.glb` | 48 | 0.13 x 0.13 x 0.23 |
| `tracker` | Poly Haven / retro_multimeter | 2,685 | 0.22 x 0.20 x 0.28 |

Pickups must stay between 0.05 and 0.6 m and under 3,000 triangles
(`server/tests/domain/test_prop_footprint_sync.py`).

### Kept as Poly Haven or procedural

`student_desk`, `locker`, `laptop`, `microwave`, `microscope`, `bunsen_burner`,
`cafeteria_table`, `bench`, `trash_can`, `recycle_bin` and `pylon` have no CC0
PS1-style equivalent in the packs above and stay Poly Haven scans (the locker also
needs a separate door node for its hinge). `whiteboard` stays procedural because the
pack's whiteboard is a freestanding easel and the quest scribble texture needs a
wall-mounted board face. `tracker` and `gps` keep their Poly Haven models. The OpenGameArt
vending-machine and freestanding-sink packs are flat-coloured or untextured and were
rejected; the Tech01 microscope ships only as a `.blend`.

## Non-uniform scale and the hinge contract

Most props still use a single uniform `scale` factor, but `ModelSpec` in
`tools/fetch_models.py` now also accepts `scale_y` / `scale_z`, defaulting
to `scale` when omitted. `locker` is the first (and so far only) model that
needs this: `painted_wooden_cabinet_02` is 0.997 x 2.569 x 0.729m at source,
and the in-game locker envelope is 0.5 x 1.8 x 0.4m — a uniform scale can't
hit all three axes at once, so it ships with `scale=0.50`, `scale_y=0.70`,
`scale_z=0.55`. `footprints.json` always writes all three (`scale`,
`scaleY`, `scaleZ`) for every prop and pickup, even when they're equal.

`ModelSpec` also carries optional `hinge_node` / `hinge_side` /
`hinge_open_rad` fields. Only `locker` sets them, pointing at the source
glTF's door node (`painted_wooden_cabinet_02_door`), `side: "left"`, and
`openRad: 1.5708` (90°). Because gltfpack can rename or strip node names
during compression, the fetch script packs any model with a `hinge_node`
using gltfpack's `-kn` (keep names) flag, then re-opens the packed `.glb`'s
JSON chunk and checks that a node name *containing* the configured
`hinge_node` string survived — the client matches the leaf mesh by name
substring, not exact equality, since gltfpack can still prefix/suffix
names even with `-kn`. If the node can't be found, the script prints a
`WARNING` to stderr instead of failing the whole run. For this pass the
node survived intact. When a model declares a hinge, `footprints.json`
carries a `hinge: { node, side, openRad }` block for it; the key is
omitted entirely for every other prop and for all pickups.

## Why there's no LOD mesh

An earlier version of this pipeline generated a `<category>/<name>_lod1.glb`
for any prop over 1,500 triangles, switched in by the client once the
camera was roughly 18m away. Running it in the actual game showed two
problems: Babylon picks a mesh's LOD level from the bounding sphere of its
*origin* mesh, and these props render as per-region thin-instance meshes
whose bounding sphere covers the whole room they're in — so a room-scale
sphere made the LOD trigger for props sitting right in front of the
player, and every model prop in a room past ~18m from its origin simply
vanished. Separately, measuring the actual frame cost showed the props
were material-bound, not triangle-bound (only ~167k active triangles
across the whole visible scene at any time) — so an LOD mesh wasn't buying
anything even where it worked correctly. The client dropped the LOD
switching code, and this pipeline no longer generates `_lod1.glb` files or
writes an `lod` key into `footprints.json`; every prop always renders its
one full-detail mesh.

## Why Sketchfab's picks weren't fetched

An earlier research pass had identified good CC-BY matches on Sketchfab for
the room door, the metal door, the whiteboard, the notice board, the
bathroom sink, the toilet, the urinal, and the exit sign. Downloading from
Sketchfab needs a `SKETCHFAB_API_TOKEN`, which is not available in this
environment, so none of those were fetched:

| Prop type | Title | Author | Sketchfab UID | Credit line |
|---|---|---|---|---|
| room door | Animated low-poly door | Dead-Soul | `b31949b739874c119d31d89a3ec942a3` | "Animated low-poly door" by Dead-Soul, licensed CC-BY, via sketchfab.com/3d-models/b31949b739874c119d31d89a3ec942a3 |
| metal door | Metal door | LiveToWin34 | `b5daec11666248c2acd0a9ff2fd22969` | "Metal door" by LiveToWin34, licensed CC-BY, via sketchfab.com/3d-models/b5daec11666248c2acd0a9ff2fd22969 |
| whiteboard | Whiteboard | Reflex_Entertainment | `eff6059c0f654aa3a5ba5e10eb59591e` | "Whiteboard" by Reflex_Entertainment, licensed CC-BY, via sketchfab.com/3d-models/eff6059c0f654aa3a5ba5e10eb59591e |
| notice board | Notice board | Viktor_ | `c7253f06bb8c49b0afcd60a509a8240c` | "Notice board" by Viktor_, licensed CC-BY, via sketchfab.com/3d-models/c7253f06bb8c49b0afcd60a509a8240c |
| bathroom sink | Bathroom sink | kEam | `45a6ab5e5a1a40b8913ab14314734ce8` | "Bathroom sink" by kEam, licensed CC-BY, via sketchfab.com/3d-models/45a6ab5e5a1a40b8913ab14314734ce8 |
| toilet | Toilet | Allan-Jay Branscombe | `6ac515a1c4154db18b5b4bd0b46d6405` | "Toilet" by Allan-Jay Branscombe, licensed CC-BY, via sketchfab.com/3d-models/6ac515a1c4154db18b5b4bd0b46d6405 |
| urinal | Urinal | CurlyFryWhy | `edbcda9bf0854e60bd6fea1a592f0bbe` | "Urinal" by CurlyFryWhy, licensed CC-BY, via sketchfab.com/3d-models/edbcda9bf0854e60bd6fea1a592f0bbe |
| exit sign | Exit sign | Adventure Dude | `56000263a5aa466c96df8e1d36533668` | "Exit sign" by Adventure Dude, licensed CC-BY, via sketchfab.com/3d-models/56000263a5aa466c96df8e1d36533668 |

As a direct consequence, **room doors, toilet-stall doors, the fuse box,
the whiteboard, and the remaining bathroom fixtures (sink, urinal, toilet
stall) stay procedural**. Their hinge/lever logic and the whiteboard's
dynamic marker-canvas texture are untouched either way — a real door model
would still need the same procedural hinge/lock code driving it, so
swapping the mesh later (once a token is available) is a pure asset change,
not a logic change.

The school locker candidate (`c32db0c65ddb46ce9e6f752b4a0b110b`, "School
locker" by an unlisted author, CC-BY) is no longer on this list: a CC0
Poly Haven stand-in (`painted_wooden_cabinet_02`, shipped as prop type
`locker`) replaced the need for it entirely, so there's nothing left to
fetch there even once a token exists. It's still recorded in
[`LICENSES.md`](../client/public/models/LICENSES.md) for context.

The rest of the procedural props (lab bench, radiator, server rack,
basketball hoop, gym mat, ball rack, piano, trophy case, skeleton,
aquarium, swiss flag, easel, globe, printer, projector, fume hood, chemical
shelf, emergency shower, coat rack, vending machine, counter, coffee
machine, fridge, closet, water dispenser, backpack, map, bulletin board,
painting, floor lamp) simply had no CC0 match at a usable size or footprint
on this pass.

## Asset pipeline

`tools/fetch_models.py` turns a manifest entry into a game-ready `.glb`.
`MANIFEST` and `PICKUP_MANIFEST` name Poly Haven slugs; `ITCH_MANIFEST` and
`OPENGAMEART_MANIFEST` name a model inside a CC0 pack (`PACKS` holds each
pack's page, author and quoted licence statement):

1. Fetch the source. Poly Haven: the files API, 1K glTF plus textures.
   Packs: `tools/asset_sources.py` downloads the archive (the scripted
   itch.io free-download flow with a 6 s throttle, or a direct
   OpenGameArt link with a browser User-Agent) and extracts only model and
   texture files into its own directory with a path-traversal guard.
   `tools/model_converters.py` turns GLB (embedded images unpacked), FBX
   (`fbx2gltf` from `client/node_modules`) and OBJ (a small writer, with an
   optional texture override for archives that ship no `.mtl`) into a loose
   glTF. `pre_yaw` rotates the whole model by a quarter turn before packing,
   `node` keeps one node of a multi-object file and drops the rest.
2. Strip normal, occlusion and metallic-roughness textures and their
   material slots, force every remaining texture onto a nearest-neighbour
   sampler (no mipmaps), and downscale each one to at most 256px per side
   (aspect kept, never upscaled; textures already within 256 px keep their
   exact size) as JPEG at quality 85, or PNG when the source is a PNG, with
   Pillow, so every prop ships one low-resolution base colour image. A
   `BLEND` material whose alpha comes from the texture becomes an alpha-tested
   `MASK` material; `material_alpha` can pin the alpha of a named material.
3. Run `gltfpack -c -vtf` (meshopt compression, float texture coordinates —
   see [Float UVs](#float-uvs-why-the-models-were-rendering-black) below)
   over the result, with a per-model `-si` simplification ratio where the
   raw mesh is denser than the game needs, `-kn` for any model that
   declares a `hinge_node` so the door/drawer node name survives
   compression, and `-sa` for any model that sets `aggressive_simplify`
   (needed when the source mesh is built from many small disconnected
   shells that plain `-si` can't decimate).
4. Write one `.glb` per prop or pickup under `client/public/models/<category>/`
   (`furniture`, `clutter`, `wall`, `lab`, `appliances`, and now `pickups`).

The script is idempotent per output file — it skips anything already built
unless `--force` is passed.

## The footprint contract

`tools/fetch_models.py` measures the scaled, world-space bounding box of
every model it produces (applying `scale` to X, `scale_y` to Y, `scale_z`
to Z) and writes it to `client/src/world/footprints.json`, alongside
`subCellMetres: 0.5`. The file has two top-level sections:

- `props`: one entry per `PropType`, each with `model`, `asset`, `scale`,
  `scaleY`, `scaleZ`, `yawOffset`, `along`, `out`, `height`, `triangles`,
  and an optional `hinge` block.
- `pickups`: one entry per `PickupKind` (`medkit`, `potion`, `compass`,
  `tracker`, `goggles`, `gps`), with the same shape minus `hinge` (pickups
  never carry one).

`server/app/domain/world/prop_specs.py` declares, independently, how many
0.5m sub-cells each prop type reserves on the placement grid. Nothing keeps
those two numbers in sync automatically — a model swap could silently
shrink or grow a mesh while the server's reservation stays stale, either
clipping neighbouring props or wasting floor space.

`server/tests/domain/test_prop_footprint_sync.py` closes that gap:

- for every prop type present in both `footprints.json` and `PROP_SPECS`,
  it asserts the sub-cell reservation contains the model (within a 10%
  tolerance) and isn't oversized by more than one sub-cell (again within
  10%);
- for every pickup, it asserts the model file exists, its largest
  dimension is between 0.05m and 0.6m, and it's under 3,000 triangles;
- for every shipped `.glb`, it asserts no material's `baseColorTexture` has
  a `KHR_texture_transform` extension (see
  [Float UVs](#float-uvs-why-the-models-were-rendering-black) below) — a
  regression guard, reading the `.glb`'s JSON chunk directly (a small
  self-contained helper, not a dependency on `tools/fetch_models.py`);
- it asserts the whole `client/public/models` tree stays under the 25MB
  budget.

If the fetch script hasn't been run yet in a fresh clone, the whole module
skips instead of failing — CI always has the committed `footprints.json`.

This pass moved three footprints to match the real meshes (unchanged from
the previous pass):

| prop | old footprint | new footprint | reason |
|---|---|---|---|
| `chair` | `(1, 1)` | `(2, 2)` | SchoolChair_01 is 0.566 x 0.675m; a 0.5 x 0.5m reservation cannot contain it |
| `bookshelf` | `(3, 1)` | `(2, 1)` | Shelf_01 is 1.003 x 0.257m, so 1.5m along the wall over-reserved by a full sub-cell |
| `side_table` | `(2, 2)` | `(2, 1)` | side_table_01 is 0.550 x 0.450m deep, one sub-cell out, not two |

`locker`'s non-uniform scale was tuned specifically to land inside its
existing `(1, 1)` `PROP_SPECS` reservation (0.5 x 0.5m): the packed model
measures 0.498 x 0.401m, comfortably inside without needing a spec change.

## Orientation: which way is the front?

The procedural prop builders that the glTF models replaced all share one
convention, and the server placement code depends on it: **a prop's
room-facing front is at local -Z, and the wall it stands against is at
local +Z**. `server/app/domain/world/frame.py` spells it out — `wall_yaw`
rotates a prop so that its local -Z points into the room. The single
documented exception is `chair`: its backrest is at -Z and the *sitter*
faces +Z, which is what `place_paired` in
`server/app/domain/world/room_patterns.py` composes with when it tucks the
teacher's chair behind the desk.

Models are authored with their visible front on either side, so `yawOffset`
(`yaw_offset` in `tools/fetch_models.py`) is a half turn (`math.pi`) wherever
the authored front points the wrong way: `bench`, `chair`, `desk`, `laptop`, `locker`, `microscope`, `microwave`, `sofa`.
For `desk` the "front" is the plain back of the double-pedestal desk; the
drawer fronts face the paired chair at +Z. `chair` is the one sitter-facing
type: its seat front points -Z in the source, so it takes the half turn to put the
sitter on +Z. Models whose authored front is along X (the derelict couch, the
fire extinguisher) are first turned a quarter with `pre_yaw` at fetch time, because
`yawOffset` is only ever 0 or a half turn. A half turn does not swap `along`/`out`,
so the measured footprints are unaffected.

`normalizeModelTemplate()` in `client/src/world/modelPropStage.ts` bakes
the offset into the template's vertices *before* it measures the bounding
box, so the wall-anchored "push the back onto the wall plane" offset is
computed on the corrected geometry, and every consumer of the template —
the thin-instanced `ModelPropStage`, plus the hand-placed chairs, lockers,
laptops and pickups under `client/src/gameplay/` — inherits the correct
orientation without applying anything itself.

Baking a half turn mirrors X, so the locker's door hinge moves from the
model's minimum-X edge to its maximum-X edge; the hinge spec therefore
records `side: "right"`, and `ModelHinge` treats `side` purely as "which
edge is the pivot" while `openRad` alone carries the swing direction.

`MODEL_NATIVE_FRONT` in `client/src/world/modelProps.ts` records the
authored front axis measured for every model, and
`client/src/world/modelProps.test.ts` asserts that combining it with the
`yawOffset` really does land every prop's front on -Z (and the chair's
sitter on +Z) — so a future model swap that changes the authored front
fails the build instead of silently turning the furniture around.

## Archetype bundles and lazy loading

`client/src/world/modelProps.ts` doesn't load every model up front. Each
`RoomArchetype` (classroom, teacher_room, cafeteria, chemistry_lab,
janitor_room, toilet, gym, server_room, hallway) declares an
`ARCHETYPE_BUNDLES` entry — the prop types that actually appear in that
kind of room — and a `COMMON_BUNDLE` covers prop types that show up almost
everywhere (chairs, laptops, bins, plants, clocks, fire extinguishers,
benches). `bundlesFor()` inspects the level's rooms via `RoomInference`,
works out which archetype the spawn point sits in, and splits every model
the level could need into two sets: `immediate` (the spawn room's archetype
plus the common bundle — loaded before the player can move) and `deferred`
(every other archetype present in the level, minus anything already
covered — loaded in the background afterward). `ModelLibrary` in
`client/src/rendering/modelLoader.ts` then loads each `PropType`'s `.glb`
lazily and caches the resulting `AssetContainer`, so a level with a gym and
a server room (neither of which declare any modelled props) never fetches
anything for them.

## The meshopt decoder

Every packed `.glb` is meshopt-compressed (`gltfpack -c -vtf`). The decoder used
to unpack these at runtime is self-hosted at
`client/public/decoders/meshopt_decoder.js` — copied by the fetch script
from the installed `meshoptimizer` npm package on every run, not pulled
from a CDN — and `ModelLibrary` points Babylon's `MeshoptCompression`
configuration at it before any model load starts.

## The 25MB budget

`client/public/models` has a hard ceiling of 25MB. After this pass (22
original props + `locker` + 6 pickups, no LOD meshes — see
[Why there's no LOD mesh](#why-theres-no-lod-mesh)) the tree sits at
**4.85MB** — `tools/fetch_models.py` prints the exact on-disk total after
every run, and the server test suite asserts it stays under budget.

## Rendering: one profile, StandardMaterial only

There is no graphics tier and no Options row to control it. Every prop type
that has a model always loads and always renders its one full-detail mesh
(see [Why there's no LOD mesh](#why-theres-no-lod-mesh)); prop types with no
CC0 match keep their procedural builder (see
[Why Sketchfab's picks weren't fetched](#why-sketchfabs-picks-werent-fetched)
below). The glTF models ship with full PBR materials (baked normal/AO/roughness
maps), but `client/src/rendering/modelMaterials.ts` converts every one of them
to a plain `StandardMaterial` (diffuse texture only, `maxSimultaneousLights = 1`)
before it's ever shown — this is the only material path glTF props render
through, matching the rest of the world (see [Materials](materials.md)).
Rendering resolution is likewise fixed: the internal render target is always
downscaled with `engine.setHardwareScalingLevel(4)` and the canvas uses
`image-rendering: pixelated` — there is no separate high-resolution mode.

## Float UVs: why the models were rendering black

The Poly Haven source meshes typically use a small sub-rectangle of the
0..1 UV space (as little as ~0.062 across), and `gltfpack`'s default
texture-coordinate quantization snaps those into a 12-bit fixed-point grid
and compensates for the resulting precision loss by writing a
`KHR_texture_transform` (a per-texture UV scale/offset, here scale ≈ 15.8)
onto the material's `baseColorTexture`. Babylon's glTF loader applies that
extension correctly under a PBR material, but the `StandardMaterial`
conversion every model goes through (see
[Rendering: one profile, StandardMaterial only](#rendering-one-profile-standardmaterial-only)
above) doesn't apply `KHR_texture_transform` at all, so every prop sampled
its texture through the wrong, untransformed UVs and rendered as a flat
black silhouette. Confirmed on `locker`: clearing its diffuse texture made
it render as a normal lit cabinet, isolating the bug to texture sampling
rather than lighting or geometry.

The fix is `gltfpack -vtf` (float texture-coordinate attributes instead of
quantized ones) on every pack invocation, which removes the need for
`KHR_texture_transform` entirely — UV accessors now span roughly 0..1
directly. `server/tests/domain/test_prop_footprint_sync.py` asserts no
shipped material carries the extension, so this can't silently regress.
Float UVs are slightly less compact than quantized ones, but the total
`client/public/models` size actually went down in this pass (removing the
LOD meshes more than offset it) — see
[The 25MB budget](#the-25mb-budget) above.

## Running the model fetch script

```
python tools/fetch_models.py [--force] [--cosmetics]
```

`--cosmetics` fetches only the CC0 player cosmetics (Poly Haven and Poly Pizza)
into `client/public/models/cosmetics/` and regenerates the cosmetics section of
`LICENSES.md`.

The script needs Pillow (from the server's Python environment) for texture
downscaling, and `gltfpack` for mesh compression — `gltfpack` isn't a
Python dependency, it's resolved from `client/node_modules/.bin`, so run
`bun install` in `client/` first. It's idempotent — re-running it skips
anything already downloaded and converted — pass `--force` to redo
everything regardless. Downloaded sources are cached under the gitignored
`tools/.model-cache/`, so repeated runs don't re-hit the Poly Haven API
or the pack sites. Delete an output `.glb` to rebuild it.
