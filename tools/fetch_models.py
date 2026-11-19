import argparse
import http.cookiejar
import json
import math
import os
import re
import shutil
import struct
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import zipfile
from dataclasses import dataclass
from pathlib import Path

from PIL import Image

from asset_sources import ArchiveExtractor as PackArchiveExtractor
from asset_sources import DirectDownloader
from asset_sources import ItchDownloader as PackItchDownloader
from model_converters import GlbUnpacker, ObjToGltf, SceneEditor

USER_AGENT = "Mozilla/5.0"
TEXTURE_MAX_PX = 256
TEXTURE_MIN_PX = 8
TEXTURE_QUALITY = 85
SUB_CELL_METRES = 0.5


@dataclass(frozen=True)
class ModelSpec:
    prop_type: str
    asset: str
    category: str
    scale: float
    simplify: float = 0.0
    yaw_offset: float = 0.0
    scale_y: float | None = None
    scale_z: float | None = None
    hinge_node: str | None = None
    hinge_side: str | None = None
    hinge_open_rad: float | None = None
    aggressive_simplify: bool = False
    source: "PackSource | None" = None
    pre_yaw: float = 0.0
    material_alpha: tuple = ()

    def __post_init__(self) -> None:
        if self.scale_y is None:
            object.__setattr__(self, "scale_y", self.scale)
        if self.scale_z is None:
            object.__setattr__(self, "scale_z", self.scale)

    def source_url(self) -> str:
        return f"https://polyhaven.com/a/{self.asset}"

    def source_name(self) -> str:
        return "Poly Haven"

    def asset_label(self) -> str:
        return self.asset

    def credited_author(self, info) -> str:
        return info.author_for(self.asset)

    def license_name(self) -> str:
        return "CC0 1.0"


@dataclass(frozen=True)
class PolyPizzaSpec(ModelSpec):
    glb_uuid: str = ""
    title: str = ""
    author: str = ""
    pack: str = ""

    def source_url(self) -> str:
        return f"https://poly.pizza/m/{self.asset}"

    def asset_label(self) -> str:
        label = f"{self.title} ({self.asset})"
        return f"{self.pack}: {label}" if self.pack else label

    def source_name(self) -> str:
        return "Poly Pizza"

    def credited_author(self, info) -> str:
        return self.author


@dataclass(frozen=True)
class ItchSpec(ModelSpec):
    page_url: str = ""
    upload_id: str = ""
    title: str = ""
    author: str = ""
    pack: str = ""
    model_member: str = ""
    nodes: tuple[str, ...] = ()
    texture_member: str = ""
    texture_max_px: int = 256

    def source_url(self) -> str:
        return self.page_url

    def source_name(self) -> str:
        return "itch.io"

    def asset_label(self) -> str:
        return f"{self.pack}: {self.title}"

    def credited_author(self, info) -> str:
        return self.author


MANIFEST: tuple[ModelSpec, ...] = (
    ModelSpec("student_desk", "SchoolDesk_01", "furniture", 1.0, 0.5),
    ModelSpec("books_pile", "binder_notebook", "clutter", 0.7, 0.1),
    ModelSpec("bench", "painted_wooden_bench", "furniture", 1.0, yaw_offset=math.pi),
    ModelSpec("cafeteria_table", "dining_table", "furniture", 1.0),
    ModelSpec("trash_can", "industrial_pastic_container", "clutter", 0.75, 0.13, aggressive_simplify=True),
    ModelSpec("recycle_bin", "plastic_crate_02", "clutter", 0.95, 0.25, aggressive_simplify=True),
    ModelSpec("pylon", "WetFloorSign_01", "clutter", 1.0),
    ModelSpec("microscope", "industrial_microscope", "lab", 0.95, 0.2, yaw_offset=math.pi),
    ModelSpec("bunsen_burner", "bunsen_burner", "lab", 1.0, 0.25),
    ModelSpec("microwave", "vintage_microwave", "appliances", 0.65, 0.3, yaw_offset=math.pi),
    ModelSpec("laptop", "classic_laptop", "appliances", 0.55, 0.25, yaw_offset=math.pi),
    ModelSpec(
        "locker", "painted_wooden_cabinet_02", "furniture", 0.50,
        scale_y=0.70, scale_z=0.55, yaw_offset=math.pi,
        hinge_node="painted_wooden_cabinet_02_door", hinge_side="right",
        hinge_open_rad=math.pi / 2,
    ),
)


PICKUP_MANIFEST: tuple[ModelSpec, ...] = (
    ModelSpec("tracker", "retro_multimeter", "pickups", 1.0, 0.3),
    ModelSpec("gps", "digital_wrist_watch", "pickups", 1.2, 0.22),
)


COSMETICS_CATEGORY = "cosmetics"

COSMETIC_MANIFEST: tuple[ModelSpec, ...] = (
    ModelSpec("backpack_schwimmweste", "life_jacket", COSMETICS_CATEGORY, 1.0, 0.1),
    ModelSpec("handitem_lupe", "magnifying_glass_01", COSMETICS_CATEGORY, 1.0, 0.1),
    ModelSpec("handitem_megafon", "Megaphone_01", COSMETICS_CATEGORY, 1.0, 0.1, aggressive_simplify=True),
    PolyPizzaSpec(
        "backpack_koffer", "7DsKpns9FM", COSMETICS_CATEGORY, 1.0,
        glb_uuid="185b3169-8d50-4419-80ca-eab21d769a25", title="Suit Case", author="smallbigsquare",
    ),
    PolyPizzaSpec(
        "backpack_abfallsack", "jYrMKg2Q7C", COSMETICS_CATEGORY, 1.0,
        glb_uuid="9cc89089-5f9a-4d6b-a7a1-57e2f78e3976", title="Trash Bag", author="Quaternius",
    ),
    ItchSpec(
        "backpack_karton", "cardboard_box_1", COSMETICS_CATEGORY, 1.0,
        page_url="https://dragon1freak.itch.io/psx-cardboard-boxes", upload_id="7460749",
        title="CardboardBox_1", author="dragon1freak", pack="PSX Cardboard Boxes",
        model_member="PSXCardboardBoxes/Models/GLB/CardboardBox_1.glb",
    ),
    PolyPizzaSpec(
        "backpack_zement", "VRfAODZ0Xk", COSMETICS_CATEGORY, 1.0,
        glb_uuid="5c18a372-e0fb-490f-aa90-8bdd04d7e92f", title="Bag", author="Quaternius",
    ),
    PolyPizzaSpec(
        "backpack_turnbeutel", "rysPhwuIP4", COSMETICS_CATEGORY, 1.0,
        glb_uuid="4f52d8a5-4ebb-4099-9686-d841a03d85dd", title="Duffel Bag", author="accidentallyc",
    ),
    ItchSpec(
        "backpack_rucksack", "Backpack", COSMETICS_CATEGORY, 1.0,
        page_url="https://elbolilloduro.itch.io/survival-psx", upload_id="6325866",
        title="Backpack", author="Elbolilloduro", pack="Survival PSX",
        model_member="Survival/Models/Survival.fbx", nodes=("Backpack",),
        texture_member="Survival/Textures/Backpack.png",
    ),
    PolyPizzaSpec(
        "mask_schutzbrille", "DBEk0SMQCt", COSMETICS_CATEGORY, 1.0,
        glb_uuid="ebadf2b5-3f28-4aa9-b0fd-942a4a6a06c5", title="Glasses", author="iPoly3D",
    ),
    PolyPizzaSpec(
        "mask_rennbrille", "4YCjSY3U6H", COSMETICS_CATEGORY, 1.0,
        glb_uuid="d9c725b3-b39a-49c9-bc51-1159c1a747db", title="Ski Goggles", author="iPoly3D",
    ),
    PolyPizzaSpec(
        "mask_papiertuete", "fLNcjJnsJi", COSMETICS_CATEGORY, 1.0,
        glb_uuid="4473a789-f73a-47d4-b73a-0e015b643325", title="Bag", author="Kenney", pack="Kenney Food Kit",
    ),
    PolyPizzaSpec(
        "hat_fischer", "lNN3PlrjSa", COSMETICS_CATEGORY, 1.0,
        glb_uuid="5f6f5355-664d-4763-b1f6-71474caf2d52", title="Hat Stylised", author="hat_my_guy",
    ),
    PolyPizzaSpec(
        "handitem_besen", "gwE8397gO3", COSMETICS_CATEGORY, 1.0,
        glb_uuid="32a3f78c-b0a0-4a9d-b88d-cd8b0652010b", title="Witch Broom", author="MiniPoly",
    ),
    ItchSpec(
        "handitem_taschenlampe", "Flashlight", COSMETICS_CATEGORY, 1.0,
        page_url="https://elbolilloduro.itch.io/exploration-objects", upload_id="10119862",
        title="Flashlight", author="Elbolilloduro", pack="Exploration objects",
        model_member="Exploration objects/Flashlight/Flashlight.fbx",
    ),
    PolyPizzaSpec(
        "handitem_werkzeugkoffer", "3ImQcIK0Gp", COSMETICS_CATEGORY, 1.0,
        glb_uuid="7c2b3946-0ee2-4626-b582-c280f1704dfc", title="Toolbox", author="CreativeTrio",
    ),
    ItchSpec(
        "handitem_signal", "Lantern", COSMETICS_CATEGORY, 1.0,
        page_url="https://elbolilloduro.itch.io/survival-psx", upload_id="6325866",
        title="Lantern", author="Elbolilloduro", pack="Survival PSX",
        model_member="Survival/Models/Survival.fbx", nodes=("Lantern",),
        texture_member="Survival/Textures/Lantern.png",
    ),
)


@dataclass(frozen=True)
class SketchfabSpec:
    prop_type: str
    uid: str
    title: str
    author: str
    license: str
    reason: str


SKETCHFAB_MANIFEST: tuple[SketchfabSpec, ...] = (
    SketchfabSpec(
        "room door", "b31949b739874c119d31d89a3ec942a3", "Animated low-poly door",
        "Dead-Soul", "CC-BY",
        "would replace the procedural classroom door mesh with a real modelled and "
        "animated door; hinge/lock logic in the client stays untouched either way",
    ),
    SketchfabSpec(
        "metal door", "b5daec11666248c2acd0a9ff2fd22969", "Metal door",
        "LiveToWin34", "CC-BY",
        "alternate door skin for janitor/server rooms, driven by the same procedural "
        "hinge logic as room door",
    ),
    SketchfabSpec(
        "whiteboard", "eff6059c0f654aa3a5ba5e10eb59591e", "Whiteboard",
        "Reflex_Entertainment", "CC-BY",
        "would give the whiteboard frame a real model while the writable face stays "
        "the dynamic marker canvas texture (whiteboardTexture.ts)",
    ),
    SketchfabSpec(
        "notice board", "c7253f06bb8c49b0afcd60a509a8240c", "Notice board",
        "Viktor_", "CC-BY",
        "would replace the procedural bulletin_board prop",
    ),
    SketchfabSpec(
        "bathroom sink", "45a6ab5e5a1a40b8913ab14314734ce8", "Bathroom sink",
        "kEam", "CC-BY",
        "Poly Haven has no bathroom fixtures at all; this is the closest CC-licensed "
        "sink candidate found for the sink prop",
    ),
    SketchfabSpec(
        "toilet", "6ac515a1c4154db18b5b4bd0b46d6405", "Toilet",
        "Allan-Jay Branscombe", "CC-BY",
        "no CC0 toilet fixture exists on Poly Haven; needed for the toilet_stall prop",
    ),
    SketchfabSpec(
        "urinal", "edbcda9bf0854e60bd6fea1a592f0bbe", "Urinal",
        "CurlyFryWhy", "CC-BY",
        "no CC0 urinal fixture exists on Poly Haven; needed for the urinal prop",
    ),
    SketchfabSpec(
        "school locker", "c32db0c65ddb46ce9e6f752b4a0b110b", "School locker",
        "Unknown", "CC-BY",
        "would have replaced the procedural locker mesh built in gameplay/lockers.ts; "
        "a CC0 Poly Haven stand-in (painted_wooden_cabinet_02, prop type `locker`) "
        "shipped instead, so this Sketchfab candidate is no longer needed even once a "
        "token becomes available",
    ),
    SketchfabSpec(
        "exit sign", "56000263a5aa466c96df8e1d36533668", "Exit sign",
        "Adventure Dude", "CC-BY",
        "would replace the procedural exit_sign prop",
    ),
)


@dataclass(frozen=True)
class PackInfo:
    pack_id: str
    name: str
    author: str
    page_url: str
    licence: str
    licence_quote: str
    suffixes: tuple[str, ...]
    archive: str
    itch_listing: str | None = None
    direct_url: str | None = None


@dataclass(frozen=True)
class PackSource:
    pack_id: str
    member: str
    node: str | None = None
    texture: str | None = None


PACKS: dict[str, PackInfo] = {
    "psx_office": PackInfo(
        "psx_office", "PSX style office pack", "valsekamerplant",
        "https://valsekamerplant.itch.io/psx-style-opulent-office", "CC0 1.0",
        "This pack is CC0 and all textures where obtained by using CC0 textures or my own photos.",
        (".glb",), "psx-office-pack.zip", itch_listing="psx office pack",
    ),
    "psx_derelict": PackInfo(
        "psx_derelict", "PSX Derelict Furniture (Standard)", "Daniel Jurys",
        "https://daniel-jurys.itch.io/psx-derelict-furniture", "CC0 1.0",
        "Licence: Creative Commons Zero v1.0 Universal",
        (".glb",), "PSX-Derelict-Furniture-Standard.zip", itch_listing="PSX-Derelict-Furniture-Standard.zip",
    ),
    "oga_fire_extinguisher": PackInfo(
        "oga_fire_extinguisher", "Fire Extinguisher", "jameswhite",
        "https://opengameart.org/content/fire-extinguisher", "CC0 1.0", "License(s): CC0",
        (".obj", ".tif"), "fire_extinguisher_model_0.zip",
        direct_url="https://opengameart.org/sites/default/files/fire_extinguisher_model_0.zip",
    ),
    "oga_first_aid_kit": PackInfo(
        "oga_first_aid_kit", "First Aid Kit 3D", "ggbotnet",
        "https://opengameart.org/content/first-aid-kit-3d", "CC0 1.0", "License(s): CC0",
        (".obj", ".mtl", ".png"), "first_aid_kit_3d_v1.1.zip",
        direct_url="https://opengameart.org/sites/default/files/_first_aid_kit_3d_v1.1.zip",
    ),
    "oga_n64_potions": PackInfo(
        "oga_n64_potions", "N64 Potions", "n64guy",
        "https://opengameart.org/content/n64-potions", "CC0 1.0", "License(s): CC0",
        (".glb",), "n64_potions.zip",
        direct_url="https://opengameart.org/sites/default/files/n64_potions.zip",
    ),
    "oga_gas_mask": PackInfo(
        "oga_gas_mask", "Gas Mask", "stratofortress",
        "https://opengameart.org/content/gas-mask", "CC0 1.0", "License(s): CC0",
        (".fbx", ".png"), "gasmask.zip",
        direct_url="https://opengameart.org/sites/default/files/gasmask.zip",
    ),
    "oga_survival_items": PackInfo(
        "oga_survival_items", "Lowpoly survival item pack", "nateonus",
        "https://opengameart.org/content/lowpoly-survival-item-pack", "CC0 1.0", "License(s): CC0",
        (".fbx", ".png"), "survival_items.zip",
        direct_url="https://opengameart.org/sites/default/files/Survival%20items.zip",
    ),
}


ITCH_MANIFEST: tuple[ModelSpec, ...] = (
    ModelSpec(
        "chair", "chair", "furniture", 1.0, yaw_offset=math.pi,
        source=PackSource("psx_derelict", "PSX-Derelict-Furniture-Standard/glb/chair.glb"),
    ),
    ModelSpec(
        "desk", "desk2_weathered", "furniture", 0.88, yaw_offset=math.pi,
        source=PackSource("psx_office", "OFFICE/desks/desk2_weathered.glb"),
    ),
    ModelSpec(
        "bookshelf", "book_case_small", "furniture", 0.83,
        source=PackSource("psx_office", "OFFICE/book_things/book_case_small.glb"),
    ),
    ModelSpec(
        "cupboard", "file_cabinet_largest", "furniture", 0.78, yaw_offset=math.pi,
        source=PackSource("psx_office", "OFFICE/file_cabinets/file_cabinet_largest.glb"),
    ),
    ModelSpec(
        "side_table", "file_cabinet_smallest", "furniture", 1.0, yaw_offset=math.pi,
        source=PackSource("psx_office", "OFFICE/file_cabinets/file_cabinet_smallest.glb"),
    ),
    ModelSpec(
        "sofa", "couch", "furniture", 1.0, yaw_offset=math.pi, pre_yaw=-math.pi / 2,
        source=PackSource("psx_derelict", "PSX-Derelict-Furniture-Standard/glb/couch.glb"),
    ),
    ModelSpec(
        "clock", "wall_clock", "wall", 0.53, yaw_offset=math.pi,
        source=PackSource("psx_office", "OFFICE/extras/wall_clock.glb"),
    ),
    ModelSpec(
        "plant", "vase", "clutter", 2.2,
        source=PackSource("psx_derelict", "PSX-Derelict-Furniture-Standard/glb/vase.glb"),
    ),
    ModelSpec(
        "papers", "paper_stack", "clutter", 1.0,
        source=PackSource("psx_office", "OFFICE/stationary/paper_stack.glb"),
    ),
    ModelSpec(
        "fridge", "fridge", "appliances", 0.85,
        source=PackSource("psx_derelict", "PSX-Derelict-Furniture-Standard/glb/fridge.glb"),
    ),
    ModelSpec(
        "vending_machine", "coffee_machine", "appliances", 0.8, yaw_offset=math.pi,
        source=PackSource("psx_office", "OFFICE/extras/coffee_machine.glb"),
    ),
    ModelSpec(
        "water_dispenser", "water_cooler", "appliances", 1.0,
        source=PackSource("psx_office", "OFFICE/extras/water_cooler.glb"),
    ),
)


OPENGAMEART_MANIFEST: tuple[ModelSpec, ...] = (
    ModelSpec(
        "fire_extinguisher", "fire_extinguisher_model", "wall", 0.078, pre_yaw=math.pi / 2,
        source=PackSource("oga_fire_extinguisher", "fire_extinguisher_model.obj", texture="fire_extinguisher_diffuse.tif"),
    ),
    ModelSpec(
        "mop_bucket", "bucket", "clutter", 0.2,
        source=PackSource("oga_survival_items", "Survival items/items.fbx", node="bucket"),
    ),
    ModelSpec(
        "medkit", "FirstAid", "pickups", 0.3,
        source=PackSource("oga_first_aid_kit", "FirstAid.obj"),
    ),
    ModelSpec(
        "potion", "potion_red", "pickups", 0.032, material_alpha=(("Liquid", 1.0),),
        source=PackSource("oga_n64_potions", "N64 Potions/GLB/Red.glb"),
    ),
    ModelSpec(
        "goggles", "gasmask", "pickups", 0.05, 0.5,
        source=PackSource("oga_gas_mask", "gasmask/gasmask.fbx"),
    ),
    ModelSpec(
        "compass", "compass", "pickups", 0.22,
        source=PackSource("oga_survival_items", "Survival items/items.fbx", node="compass"),
    ),
)


_IDENTITY = (1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0)


def _mat_mul(a, b):
    out = [0.0] * 16
    for c in range(4):
        for r in range(4):
            out[c * 4 + r] = sum(a[k * 4 + r] * b[c * 4 + k] for k in range(4))
    return out


def _trs_matrix(node):
    if "matrix" in node:
        return list(node["matrix"])
    t = node.get("translation", [0, 0, 0])
    r = node.get("rotation", [0, 0, 0, 1])
    s = node.get("scale", [1, 1, 1])
    x, y, z, w = r
    matrix = [
        1 - 2 * (y * y + z * z), 2 * (x * y + z * w), 2 * (x * z - y * w), 0,
        2 * (x * y - z * w), 1 - 2 * (x * x + z * z), 2 * (y * z + x * w), 0,
        2 * (x * z + y * w), 2 * (y * z - x * w), 1 - 2 * (x * x + y * y), 0,
        0, 0, 0, 1,
    ]
    for c in range(3):
        for r_ in range(3):
            matrix[c * 4 + r_] *= s[c]
    matrix[12], matrix[13], matrix[14] = t
    return matrix


def _transform_point(matrix, point):
    x, y, z = point
    return (
        matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12],
        matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13],
        matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14],
    )


def _read_json_chunk(data: bytes) -> dict:
    offset = 12
    while offset < len(data):
        chunk_length, chunk_type = struct.unpack_from("<II", data, offset)
        chunk = data[offset + 8: offset + 8 + chunk_length]
        if chunk_type == 0x4E4F534A:
            return json.loads(chunk.decode("utf-8"))
        offset += 8 + chunk_length + ((4 - chunk_length % 4) % 4)
    raise RuntimeError("no JSON chunk found in GLB")


class GlbAnalyzer:
    @staticmethod
    def bounding_box(path: Path):
        data = path.read_bytes()
        if data[:4] != b"glTF":
            raise RuntimeError(f"{path} is not a binary glTF")
        document = _read_json_chunk(data)
        nodes = document.get("nodes", [])
        meshes = document.get("meshes", [])
        accessors = document.get("accessors", [])
        lo = [math.inf, math.inf, math.inf]
        hi = [-math.inf, -math.inf, -math.inf]

        def walk(index: int, parent) -> None:
            node = nodes[index]
            world = _mat_mul(parent, _trs_matrix(node))
            if "mesh" in node:
                for primitive in meshes[node["mesh"]].get("primitives", []):
                    accessor = accessors[primitive["attributes"]["POSITION"]]
                    minimum, maximum = accessor.get("min"), accessor.get("max")
                    if not minimum or not maximum:
                        continue
                    for cx in (minimum[0], maximum[0]):
                        for cy in (minimum[1], maximum[1]):
                            for cz in (minimum[2], maximum[2]):
                                point = _transform_point(world, (cx, cy, cz))
                                for i in range(3):
                                    lo[i] = min(lo[i], point[i])
                                    hi[i] = max(hi[i], point[i])
            for child in node.get("children", []):
                walk(child, world)

        for scene in document.get("scenes", []):
            for node_index in scene.get("nodes", []):
                walk(node_index, _IDENTITY)
        return lo, hi

    @staticmethod
    def triangle_count(path: Path) -> int:
        data = path.read_bytes()
        document = _read_json_chunk(data)
        total = 0
        for mesh in document.get("meshes", []):
            for primitive in mesh.get("primitives", []):
                if "indices" in primitive:
                    total += document["accessors"][primitive["indices"]]["count"] // 3
        return total


class GlbOrigin:
    JSON_TYPE = 0x4E4F534A

    @staticmethod
    def centre_on_base(path: Path) -> bool:
        data = path.read_bytes()
        document = _read_json_chunk(data)
        scenes = document.get("scenes", [])
        if len(scenes) != 1:
            return False
        lo, hi = GlbAnalyzer.bounding_box(path)
        shift = [-(lo[0] + hi[0]) / 2, -lo[1], -(lo[2] + hi[2]) / 2]
        if all(abs(v) < 1e-6 for v in shift):
            return False
        nodes = document["nodes"]
        nodes.append({"name": "origin", "translation": shift, "children": list(scenes[0]["nodes"])})
        scenes[0]["nodes"] = [len(nodes) - 1]
        payload = json.dumps(document, separators=(",", ":")).encode("utf-8")
        payload += b" " * ((4 - len(payload) % 4) % 4)
        out = bytearray(data[:12])
        offset = 12
        while offset < len(data):
            chunk_length, chunk_type = struct.unpack_from("<II", data, offset)
            if chunk_type == GlbOrigin.JSON_TYPE:
                out += struct.pack("<II", len(payload), chunk_type) + payload
            else:
                out += data[offset: offset + 8 + chunk_length + ((4 - chunk_length % 4) % 4)]
            offset += 8 + chunk_length + ((4 - chunk_length % 4) % 4)
        struct.pack_into("<I", out, 8, len(out))
        path.write_bytes(bytes(out))
        return True


class Downloader:
    def __init__(self, cache_dir: Path):
        self.cache_dir = cache_dir
        self.cache_dir.mkdir(parents=True, exist_ok=True)

    def fetch(self, url: str, relative_path: str) -> Path:
        dest = self.cache_dir / relative_path
        if dest.exists() and dest.stat().st_size > 0:
            return dest
        dest.parent.mkdir(parents=True, exist_ok=True)
        last_error = None
        for attempt in range(1, 4):
            try:
                request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
                with urllib.request.urlopen(request, timeout=240) as response:
                    data = response.read()
                if not data:
                    raise RuntimeError("empty response body")
                tmp = dest.parent / (dest.name + ".part")
                tmp.write_bytes(data)
                tmp.replace(dest)
                return dest
            except Exception as error:
                last_error = error
                if attempt < 3:
                    time.sleep(2 * attempt)
        raise RuntimeError(f"failed to download {url}: {last_error}")

    def fetch_json(self, url: str) -> dict:
        request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
        with urllib.request.urlopen(request, timeout=60) as response:
            return json.loads(response.read().decode("utf-8"))


class PolyHavenAsset:
    FILES_URL = "https://api.polyhaven.com/files/{asset}"

    def __init__(self, spec: ModelSpec, downloader: Downloader):
        self.spec = spec
        self.downloader = downloader

    @property
    def cache_name(self) -> str:
        return self.spec.asset

    def fetch_gltf(self, lod: str = "1k") -> Path:
        files = self.downloader.fetch_json(self.FILES_URL.format(asset=self.spec.asset))
        entry = files["gltf"][lod]["gltf"]
        main = self.downloader.fetch(entry["url"], f"{self.spec.asset}/{self.spec.asset}.gltf")
        for rel, info in (entry.get("include") or {}).items():
            self.downloader.fetch(info["url"], f"{self.spec.asset}/{rel}")
        return main


class PolyPizzaAsset:
    GLB_URL = "https://static.poly.pizza/{uuid}.glb"

    def __init__(self, spec: PolyPizzaSpec, downloader: Downloader):
        self.spec = spec
        self.downloader = downloader

    @property
    def cache_name(self) -> str:
        return f"polypizza/{self.spec.asset}"

    def fetch_gltf(self) -> Path:
        return self.downloader.fetch(
            self.GLB_URL.format(uuid=self.spec.glb_uuid),
            f"{self.cache_name}/{self.spec.asset}.glb",
        )


class ItchDownloader:
    REQUEST_GAP_SECONDS = 3.0
    RETRY_WAIT_SECONDS = 25.0
    MAX_ATTEMPTS = 5

    def __init__(self, cache_dir: Path):
        self.cache_dir = cache_dir
        self.cookies = http.cookiejar.CookieJar()
        self.opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(self.cookies))
        self.opener.addheaders = [("User-Agent", USER_AGENT)]

    def _open(self, request) -> bytes:
        for attempt in range(1, self.MAX_ATTEMPTS + 1):
            time.sleep(self.REQUEST_GAP_SECONDS)
            try:
                return self.opener.open(request, timeout=240).read()
            except urllib.error.HTTPError as error:
                if error.code != 429 or attempt == self.MAX_ATTEMPTS:
                    raise
                time.sleep(self.RETRY_WAIT_SECONDS * attempt)
        raise RuntimeError("unreachable")

    def _get(self, url: str) -> str:
        return self._open(url).decode("utf-8", "replace")

    def _post(self, url: str, fields: dict) -> str:
        body = urllib.parse.urlencode(fields).encode("utf-8")
        return self._open(urllib.request.Request(url, body)).decode("utf-8", "replace")

    @staticmethod
    def _csrf(html: str) -> str:
        match = re.search(r'csrf_token" value="([^"]*)', html)
        if not match:
            raise RuntimeError("itch.io page has no csrf token")
        return match.group(1)

    def fetch(self, spec: "ItchSpec") -> Path:
        dest = self.cache_dir / "itch" / f"{spec.upload_id}.bin"
        if dest.exists() and dest.stat().st_size > 0:
            return dest
        dest.parent.mkdir(parents=True, exist_ok=True)
        token = self._csrf(self._get(spec.page_url))
        download_page = json.loads(self._post(spec.page_url + "/download_url", {"csrf_token": token}))["url"]
        token = self._csrf(self._get(download_page))
        link = json.loads(self._post(
            f"{spec.page_url}/file/{spec.upload_id}?source=view_game&as_props=1",
            {"csrf_token": token},
        ))["url"]
        data = self._open(link)
        if not data:
            raise RuntimeError(f"empty itch.io download for upload {spec.upload_id}")
        part = dest.parent / (dest.name + ".part")
        part.write_bytes(data)
        part.replace(dest)
        return dest


class ArchiveExtractor:
    SEVEN_ZIP_CANDIDATES = (
        "7z", "7za", r"C:\Program Files\7-Zip\7z.exe", r"C:\Program Files (x86)\7-Zip\7z.exe",
    )

    def extract(self, archive: Path, dest: Path) -> Path:
        if dest.is_dir() and any(dest.iterdir()):
            return dest
        dest.mkdir(parents=True, exist_ok=True)
        if archive.read_bytes()[:2] == b"PK":
            self._extract_zip(archive, dest)
        else:
            self._extract_with_seven_zip(archive, dest)
        return dest

    @staticmethod
    def _extract_zip(archive: Path, dest: Path) -> None:
        root = dest.resolve()
        with zipfile.ZipFile(archive) as bundle:
            for member in bundle.namelist():
                target = (dest / member).resolve()
                if root != target and root not in target.parents:
                    raise RuntimeError(f"unsafe path in archive: {member}")
            bundle.extractall(dest)

    def _extract_with_seven_zip(self, archive: Path, dest: Path) -> None:
        binary = next(
            (c for c in self.SEVEN_ZIP_CANDIDATES if shutil.which(c) or Path(c).exists()), None,
        )
        if binary is None:
            raise RuntimeError("7-Zip is required to unpack rar archives")
        result = subprocess.run(
            [binary, "x", "-y", f"-o{dest}", str(archive)], capture_output=True, text=True,
        )
        if result.returncode != 0:
            raise RuntimeError(f"7-Zip failed for {archive.name}: {result.stdout[-300:]}")


class Fbx2GltfConverter:
    PACKAGE = "fbx2gltf@0.9.7-p1"

    def __init__(self, cache_dir: Path):
        self.root = cache_dir / "fbx2gltf"

    def _binary(self) -> Path:
        if sys.platform == "darwin":
            folder = "Darwin"
        elif os.name == "nt":
            folder = "Windows_NT"
        else:
            folder = "Linux"
        name = "FBX2glTF.exe" if os.name == "nt" else "FBX2glTF"
        return self.root / "node_modules" / "fbx2gltf" / "bin" / folder / name

    def _ensure_installed(self) -> Path:
        binary = self._binary()
        if binary.exists():
            return binary
        self.root.mkdir(parents=True, exist_ok=True)
        (self.root / "package.json").write_text('{"name":"fbx2gltf-host","private":true}\n', encoding="utf-8")
        result = subprocess.run(
            ["bun", "add", self.PACKAGE], cwd=self.root, capture_output=True, text=True,
            shell=os.name == "nt",
        )
        if result.returncode != 0 or not binary.exists():
            raise RuntimeError(f"could not install {self.PACKAGE}: {result.stderr[-300:]}")
        return binary

    def convert(self, source: Path, dest: Path) -> Path:
        binary = self._ensure_installed()
        dest.parent.mkdir(parents=True, exist_ok=True)
        result = subprocess.run(
            [str(binary), "--binary", "--input", str(source), "--output", str(dest.with_suffix(""))],
            capture_output=True, text=True,
        )
        if result.returncode != 0 or not dest.exists():
            raise RuntimeError(f"FBX2glTF failed for {source.name}: {result.stderr[-300:]}")
        return dest


class GlbRewriter:
    JSON_TYPE = 0x4E4F534A

    def __init__(self, path: Path):
        self.path = path
        data = path.read_bytes()
        if data[:4] != b"glTF":
            raise RuntimeError(f"{path} is not a binary glTF")
        self.chunks: list[tuple[int, bytes]] = []
        self.document: dict = {}
        offset = 12
        while offset < len(data):
            length, kind = struct.unpack_from("<II", data, offset)
            body = data[offset + 8: offset + 8 + length]
            if kind == self.JSON_TYPE:
                self.document = json.loads(body.decode("utf-8"))
            self.chunks.append((kind, body))
            offset += 8 + length + ((4 - length % 4) % 4)

    def keep_nodes(self, names: tuple[str, ...]) -> None:
        nodes = self.document["nodes"]
        scene = self.document["scenes"][self.document.get("scene", 0)]
        roots = [nodes[i] for i in scene["nodes"]]
        if len(roots) == 1 and "mesh" not in roots[0] and roots[0].get("children"):
            holder = roots[0]
            holder["children"] = [i for i in holder["children"] if nodes[i].get("name") in names]
            if not holder["children"]:
                raise RuntimeError(f"none of {names} found in {self.path.name}")
        else:
            scene["nodes"] = [i for i in scene["nodes"] if nodes[i].get("name") in names]
        self._prune_unreachable()

    def _prune_unreachable(self) -> None:
        nodes = self.document["nodes"]
        scene = self.document["scenes"][self.document.get("scene", 0)]
        reachable: list[int] = []
        pending = list(scene["nodes"])
        while pending:
            index = pending.pop(0)
            if index in reachable:
                continue
            reachable.append(index)
            pending.extend(nodes[index].get("children", []))
        reachable.sort()
        node_map = {old: new for new, old in enumerate(reachable)}
        used_meshes = sorted({nodes[i]["mesh"] for i in reachable if "mesh" in nodes[i]})
        mesh_map = {old: new for new, old in enumerate(used_meshes)}
        kept = []
        for old in reachable:
            node = dict(nodes[old])
            if "children" in node:
                node["children"] = [node_map[c] for c in node["children"]]
            if "mesh" in node:
                node["mesh"] = mesh_map[node["mesh"]]
            kept.append(node)
        used_materials = sorted({
            primitive["material"]
            for mesh_index in used_meshes
            for primitive in self.document["meshes"][mesh_index]["primitives"]
            if "material" in primitive
        })
        material_map = {old: new for new, old in enumerate(used_materials)}
        meshes = []
        for mesh_index in used_meshes:
            mesh = dict(self.document["meshes"][mesh_index])
            mesh["primitives"] = [dict(p) for p in mesh["primitives"]]
            for primitive in mesh["primitives"]:
                if "material" in primitive:
                    primitive["material"] = material_map[primitive["material"]]
            meshes.append(mesh)
        self.document["nodes"] = kept
        self.document["meshes"] = meshes
        self.document["materials"] = [self.document["materials"][i] for i in used_materials]
        scene["nodes"] = [node_map[i] for i in scene["nodes"]]

    def bind_texture(self, uri: str) -> None:
        self.document["images"] = [{"uri": uri}]
        self.document["textures"] = [{"sampler": 0, "source": 0}]
        self.document["samplers"] = [
            {"magFilter": 9728, "minFilter": 9728, "wrapS": 10497, "wrapT": 10497},
        ]
        for material in self.document.get("materials", []):
            pbr = material.setdefault("pbrMetallicRoughness", {})
            pbr["baseColorTexture"] = {"index": 0, "texCoord": 0}
            pbr["baseColorFactor"] = [1.0, 1.0, 1.0, 1.0]
            pbr["metallicFactor"] = 0.0
            pbr["roughnessFactor"] = 1.0

    def drop_emissive(self) -> None:
        for material in self.document.get("materials", []):
            material.pop("emissiveTexture", None)
            material.pop("emissiveFactor", None)

    def save(self, dest: Path) -> None:
        payload = json.dumps(self.document, separators=(",", ":")).encode("utf-8")
        payload += b" " * ((4 - len(payload) % 4) % 4)
        out = bytearray(b"glTF" + struct.pack("<II", 2, 0))
        for kind, body in self.chunks:
            body = payload if kind == self.JSON_TYPE else body
            out += struct.pack("<II", len(body), kind) + body + b"\x00" * ((4 - len(body) % 4) % 4)
        struct.pack_into("<I", out, 8, len(out))
        dest.write_bytes(bytes(out))


class PsxTexture:
    @staticmethod
    def downscale(source: Path, dest: Path, max_px: int) -> None:
        image = Image.open(source)
        if max(image.size) > max_px:
            ratio = max_px / max(image.size)
            size = (max(1, round(image.width * ratio)), max(1, round(image.height * ratio)))
            image = image.resize(size, Image.LANCZOS)
        image = image.convert("RGBA") if "A" in image.getbands() else image.convert("RGB")
        dest.parent.mkdir(parents=True, exist_ok=True)
        image.save(dest, "PNG")


class ItchAsset:
    def __init__(self, spec: ItchSpec, downloader: Downloader):
        self.spec = spec
        self.downloader = downloader
        self.itch = ItchDownloader(downloader.cache_dir)
        self.extractor = ArchiveExtractor()
        self.converter = Fbx2GltfConverter(downloader.cache_dir)

    @property
    def cache_name(self) -> str:
        return f"itch/{self.spec.prop_type}"

    def fetch_gltf(self) -> Path:
        cache = self.downloader.cache_dir
        archive = self.itch.fetch(self.spec)
        unpacked = self.extractor.extract(archive, cache / "itch" / f"{self.spec.upload_id}_files")
        source = unpacked / self.spec.model_member
        if not source.is_file():
            raise RuntimeError(f"{self.spec.model_member} missing from upload {self.spec.upload_id}")
        work = cache / self.cache_name
        work.mkdir(parents=True, exist_ok=True)
        prepared = work / f"{self.spec.prop_type}.glb"
        if source.suffix.lower() == ".fbx":
            self.converter.convert(source, prepared)
        else:
            shutil.copyfile(source, prepared)
        rewriter = GlbRewriter(prepared)
        if self.spec.nodes:
            rewriter.keep_nodes(self.spec.nodes)
        if self.spec.texture_member:
            texture_name = f"{self.spec.prop_type}.png"
            PsxTexture.downscale(
                unpacked / self.spec.texture_member, work / texture_name, self.spec.texture_max_px,
            )
            rewriter.bind_texture(texture_name)
        rewriter.drop_emissive()
        rewriter.save(prepared)
        return prepared


class AssetFactory:
    @staticmethod
    def create(spec: ModelSpec, downloader: Downloader):
        if isinstance(spec, ItchSpec):
            return ItchAsset(spec, downloader)
        if isinstance(spec, PolyPizzaSpec):
            return PolyPizzaAsset(spec, downloader)
        return PolyHavenAsset(spec, downloader)


class PackStore:
    MAX_MEMBER_BYTES = 16 * 1024 * 1024

    def __init__(self, cache_dir: Path):
        self.cache_dir = cache_dir
        self.archive_dir = cache_dir / "archives"
        self.extract_root = cache_dir / "packs"
        self._itch: dict[str, PackItchDownloader] = {}

    def root(self, pack: PackInfo) -> Path:
        extract_dir = self.extract_root / pack.pack_id
        if extract_dir.is_dir() and any(extract_dir.iterdir()):
            return extract_dir
        archive = self._download(pack)
        PackArchiveExtractor(pack.suffixes, self.MAX_MEMBER_BYTES).extract(archive, extract_dir)
        return extract_dir

    def _download(self, pack: PackInfo) -> Path:
        if pack.itch_listing:
            downloader = self._itch.setdefault(pack.pack_id, PackItchDownloader(pack.page_url, self.archive_dir))
            return downloader.fetch(pack.itch_listing, pack.archive)
        return DirectDownloader(self.archive_dir).fetch(pack.direct_url, pack.archive)


class PackAsset:
    def __init__(self, spec: ModelSpec, store: PackStore, client_dir: Path):
        self.spec = spec
        self.store = store
        self.client_dir = client_dir

    def fetch_gltf(self) -> Path:
        source = self.spec.source
        info = PACKS[source.pack_id]
        member = self.store.root(info) / source.member
        if not member.is_file():
            raise RuntimeError(f"{source.member} not found in pack {info.pack_id}")
        work = self.store.cache_dir / "work" / self.spec.prop_type
        if work.exists():
            shutil.rmtree(work)
        work.mkdir(parents=True)
        stem = self.spec.asset
        suffix = member.suffix.lower()
        if suffix == ".glb":
            gltf = GlbUnpacker().unpack(member, work, stem)
        elif suffix == ".fbx":
            glb = work / "fbx" / f"{stem}.glb"
            Fbx2GltfConverter(self.store.cache_dir).convert(member, glb)
            gltf = GlbUnpacker().unpack(glb, work, stem)
        elif suffix == ".obj":
            gltf = ObjToGltf().convert(member, work, stem, source.texture)
        else:
            raise RuntimeError(f"unsupported model format {suffix}")
        SceneEditor().edit(gltf, source.node, self.spec.pre_yaw)
        return gltf


class AuthorCache:
    def __init__(self, path: Path):
        self.path = path
        self._data = {}
        if path.exists():
            try:
                self._data = json.loads(path.read_text(encoding="utf-8"))
            except Exception:
                self._data = {}

    def get(self, asset: str):
        return self._data.get(asset)

    def set(self, asset: str, author: str) -> None:
        self._data[asset] = author
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.path.write_text(json.dumps(self._data, indent=2, sort_keys=True) + "\n", encoding="utf-8")


class PolyHavenInfo:
    INFO_URL = "https://api.polyhaven.com/info/{asset}"

    def __init__(self, downloader: Downloader, cache: AuthorCache):
        self.downloader = downloader
        self.cache = cache

    def author_for(self, asset: str) -> str:
        cached = self.cache.get(asset)
        if cached is not None:
            return cached
        info = self.downloader.fetch_json(self.INFO_URL.format(asset=asset))
        authors = info.get("authors") or {}
        name = ", ".join(authors.keys()) if authors else "Poly Haven"
        self.cache.set(asset, name)
        return name


class PowerOfTwo:
    @staticmethod
    def floor(value: int, minimum: int = TEXTURE_MIN_PX) -> int:
        return max(minimum, 1 << (max(1, value).bit_length() - 1))


class PsxTextureSize:
    def __init__(self, max_px: int = TEXTURE_MAX_PX):
        self.max_px = max_px

    def target(self, width: int, height: int) -> tuple[int, int]:
        if max(width, height) <= self.max_px:
            return (width, height)
        ratio = min(1.0, self.max_px / max(width, height))
        return (
            min(width, PowerOfTwo.floor(int(width * ratio))),
            min(height, PowerOfTwo.floor(int(height * ratio))),
        )


class GltfMaterialStripper:
    NEAREST_SAMPLER = {"magFilter": 9728, "minFilter": 9728, "wrapS": 10497, "wrapT": 10497}
    REMOVED_SLOTS = ("normalTexture", "occlusionTexture")
    REMOVED_PBR_SLOTS = ("metallicRoughnessTexture",)

    def strip(self, source: Path, dest: Path, alpha: dict | None = None) -> list[str]:
        document = json.loads(source.read_text(encoding="utf-8"))
        for material in document.get("materials", []):
            for slot in self.REMOVED_SLOTS:
                material.pop(slot, None)
            pbr = material.setdefault("pbrMetallicRoughness", {})
            for slot in self.REMOVED_PBR_SLOTS:
                pbr.pop(slot, None)
            pbr["metallicFactor"] = 0.0
            pbr["roughnessFactor"] = 1.0
            if alpha and material.get("name") in alpha:
                factor = list(pbr.get("baseColorFactor", [1, 1, 1, 1]))
                factor[3] = alpha[material["name"]]
                pbr["baseColorFactor"] = factor
            if material.get("alphaMode") == "BLEND" and pbr.get("baseColorFactor", [1, 1, 1, 1])[3] >= 1.0:
                material["alphaMode"] = "MASK"
                material["alphaCutoff"] = 0.5
        kept = self._compact(document)
        dest.write_text(json.dumps(document), encoding="utf-8")
        return kept

    @staticmethod
    def _referenced_textures(document: dict) -> set[int]:
        used: set[int] = set()

        def walk(node) -> None:
            if isinstance(node, dict):
                for key, value in node.items():
                    if key.endswith("Texture") and isinstance(value, dict) and "index" in value:
                        used.add(value["index"])
                    else:
                        walk(value)
            elif isinstance(node, list):
                for item in node:
                    walk(item)

        walk(document.get("materials", []))
        return used

    def _compact(self, document: dict) -> list[str]:
        textures = document.get("textures", [])
        used = sorted(self._referenced_textures(document))
        texture_map = {old: new for new, old in enumerate(used)}
        images_used = sorted({textures[i]["source"] for i in used if "source" in textures[i]})
        image_map = {old: new for new, old in enumerate(images_used)}
        new_textures = []
        for old in used:
            texture = dict(textures[old])
            if "source" in texture:
                texture["source"] = image_map[texture["source"]]
            texture["sampler"] = 0
            new_textures.append(texture)

        def remap(node) -> None:
            if isinstance(node, dict):
                for key, value in node.items():
                    if key.endswith("Texture") and isinstance(value, dict) and "index" in value:
                        value["index"] = texture_map[value["index"]]
                    else:
                        remap(value)
            elif isinstance(node, list):
                for item in node:
                    remap(item)

        remap(document.get("materials", []))
        images = document.get("images", [])
        kept_images = [images[i] for i in images_used]
        if new_textures:
            document["textures"] = new_textures
            document["samplers"] = [dict(self.NEAREST_SAMPLER)]
            document["images"] = kept_images
        else:
            document.pop("textures", None)
            document.pop("images", None)
            document.pop("samplers", None)
        return [image["uri"] for image in kept_images if "uri" in image]


class TextureDownscaler:
    def __init__(self, sizer: PsxTextureSize | None = None, quality: int = TEXTURE_QUALITY):
        self.sizer = sizer or PsxTextureSize()
        self.quality = quality

    def process(self, asset_root: Path, uris: list[str]) -> None:
        for uri in uris:
            path = asset_root / uri
            if not path.is_file():
                continue
            image = Image.open(path)
            image.load()
            target = self.sizer.target(image.width, image.height)
            if target == image.size:
                continue
            if path.suffix.lower() == ".png":
                mode = "RGBA" if "A" in image.getbands() else "RGB"
                image.convert(mode).resize(target, Image.NEAREST).save(path, "PNG")
                continue
            resized = image.convert("RGB").resize(target, Image.LANCZOS)
            resized.save(path, "JPEG", quality=self.quality)


class GltfPacker:
    WINDOWS_CANDIDATES = ("gltfpack.cmd", "gltfpack.exe")
    POSIX_CANDIDATES = ("gltfpack",)

    def __init__(self, client_dir: Path):
        self.binary = self._locate(client_dir)

    def _locate(self, client_dir: Path) -> Path:
        bin_dir = client_dir / "node_modules" / ".bin"
        names = self.WINDOWS_CANDIDATES if os.name == "nt" else self.POSIX_CANDIDATES
        for name in names:
            candidate = bin_dir / name
            if candidate.exists():
                return candidate
        raise RuntimeError(
            f"gltfpack binary not found under {bin_dir} — run `bun install` in client/"
        )

    def pack(self, source: Path, dest: Path, simplify: float, extra_args: list[str] | None = None) -> None:
        dest.parent.mkdir(parents=True, exist_ok=True)
        command = [str(self.binary), "-i", str(source), "-o", str(dest), "-c", "-vtf"]
        if simplify > 0.0:
            command += ["-si", str(simplify)]
        if extra_args:
            command += extra_args
        result = subprocess.run(command, capture_output=True, text=True)
        if result.returncode != 0:
            raise RuntimeError(
                f"gltfpack failed for {source.name}: {result.stdout[-400:]} {result.stderr[-400:]}"
            )


class DecoderInstaller:
    def __init__(self, client_dir: Path):
        self.source = client_dir / "node_modules" / "meshoptimizer" / "meshopt_decoder.cjs"
        self.dest = client_dir / "public" / "decoders" / "meshopt_decoder.js"

    def install(self) -> Path:
        if not self.source.exists():
            raise RuntimeError(
                f"meshoptimizer package not found at {self.source} — run `bun install` in client/"
            )
        self.dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(self.source, self.dest)
        return self.dest


@dataclass
class ModelResult:
    spec: ModelSpec
    output_path: Path
    triangles: int
    along: float
    out: float
    height: float
    bytes_written: int
    skipped: bool


class ModelProcessor:
    def __init__(
        self,
        spec: ModelSpec,
        output_root: Path,
        downloader: Downloader,
        packer: GltfPacker,
        downscaler: TextureDownscaler,
        stripper: GltfMaterialStripper,
        packs: PackStore | None = None,
        client_dir: Path | None = None,
    ):
        self.packs = packs
        self.client_dir = client_dir
        self.spec = spec
        self.output_path = output_root / spec.category / f"{spec.prop_type}.glb"
        self.downloader = downloader
        self.packer = packer
        self.downscaler = downscaler
        self.stripper = stripper

    def is_complete(self) -> bool:
        return self.output_path.exists() and self.output_path.stat().st_size > 0

    def _measure(self) -> ModelResult:
        lo, hi = GlbAnalyzer.bounding_box(self.output_path)
        width = (hi[0] - lo[0]) * self.spec.scale
        height = (hi[1] - lo[1]) * self.spec.scale_y
        depth = (hi[2] - lo[2]) * self.spec.scale_z
        along, out = width, depth
        quarter_turns = round(self.spec.yaw_offset / (math.pi / 2)) if self.spec.yaw_offset else 0
        if quarter_turns % 2 != 0:
            along, out = out, along
        triangles = GlbAnalyzer.triangle_count(self.output_path)
        return ModelResult(
            self.spec,
            self.output_path,
            triangles,
            round(along, 4),
            round(out, 4),
            round(height, 4),
            self.output_path.stat().st_size,
            skipped=False,
        )

    def _verify_hinge(self) -> None:
        data = self.output_path.read_bytes()
        document = _read_json_chunk(data)
        names = [node.get("name", "") for node in document.get("nodes", [])]
        found = any(self.spec.hinge_node in name for name in names)
        if not found:
            print(
                f"WARNING: hinge node '{self.spec.hinge_node}' not found in packed "
                f"{self.output_path} — node names present: {names}",
                file=sys.stderr,
            )

    @staticmethod
    def _as_gltf(source: Path) -> Path:
        if source.suffix.lower() != ".glb":
            return source
        unpacked = source.parent / "unpacked"
        if unpacked.exists():
            shutil.rmtree(unpacked)
        return GlbUnpacker().unpack(source, unpacked, source.stem)

    def process(self, force: bool) -> ModelResult:
        if self.spec.source is not None:
            asset = PackAsset(self.spec, self.packs, self.client_dir)
        else:
            asset = AssetFactory.create(self.spec, self.downloader)

        if force or not self.is_complete():
            source_gltf = self._as_gltf(asset.fetch_gltf())
            asset_root = source_gltf.parent
            main_gltf = asset_root / f"{self.spec.asset}.psx.gltf"
            kept = self.stripper.strip(source_gltf, main_gltf, dict(self.spec.material_alpha))
            self.downscaler.process(asset_root, kept)
            extra_args = []
            if self.spec.hinge_node:
                extra_args.append("-kn")
            if self.spec.aggressive_simplify:
                extra_args.append("-sa")
            self.packer.pack(main_gltf, self.output_path, self.spec.simplify, extra_args or None)
            if self.spec.category == COSMETICS_CATEGORY:
                GlbOrigin.centre_on_base(self.output_path)
            result = self._measure()
        else:
            result = self._measure()
            result.skipped = True

        if self.spec.hinge_node:
            self._verify_hinge()

        return result


class LicenseGenerator:
    TABLE_HEADER = (
        "| Prop type | Model file | Source asset | Source URL | Author | License |",
        "|---|---|---|---|---|---|",
    )

    def __init__(self, specs, info: PolyHavenInfo, sketchfab):
        self.specs = specs
        self.info = info
        self.sketchfab = sketchfab

    def _rows(self, specs) -> list[str]:
        rows = []
        for spec in sorted(specs, key=lambda s: s.prop_type):
            model_file = f"{spec.category}/{spec.prop_type}.glb"
            rows.append(
                f"| `{spec.prop_type}` | `{model_file}` | {spec.asset_label()} | {spec.source_url()} | "
                f"{spec.credited_author(self.info)} | {spec.license_name()} |"
            )
        return rows

    def build(self) -> str:
        core = [s for s in self.specs if s.category != COSMETICS_CATEGORY]
        cosmetics = [s for s in self.specs if s.category == COSMETICS_CATEGORY]
        lines = []
        lines.append("# Model Licenses")
        lines.append("")
        lines.append(
            "Every model in this directory is CC0 1.0 - from Poly Haven, Poly Pizza, itch.io or the "
            "retro model packs listed below - and requires no attribution to use, modify or "
            "redistribute; the tables credit the original authors anyway."
        )
        lines.append("")
        lines.append("## Poly Haven")
        lines.append("")
        lines.extend(self.TABLE_HEADER)
        lines.extend(self._rows([s for s in core if s.source is None]))
        lines.append("")
        lines.append("## Retro model packs")
        lines.append("")
        lines.append(
            "Low-poly PS1/PS2-style models. Each is fetched by `tools/fetch_models.py`, stripped to a "
            "single nearest-sampled base colour texture and packed with gltfpack. The last column "
            "quotes the licence statement from the pack's page."
        )
        lines.append("")
        lines.append("| Prop type | Model file | Pack | Source file | Author | Pack page | License | Licence statement |")
        lines.append("|---|---|---|---|---|---|---|---|")
        packed = [s for s in core if s.source is not None]
        for spec in sorted(packed, key=lambda s: s.prop_type):
            info = PACKS[spec.source.pack_id]
            lines.append(
                f"| `{spec.prop_type}` | `{spec.category}/{spec.prop_type}.glb` | {info.name} | "
                f"`{spec.source.member}` | {info.author} | {info.page_url} | {info.licence} | "
                f"\"{info.licence_quote}\" |"
            )
        lines.append("")
        lines.append("## Cosmetics")
        lines.append("")
        lines.append(
            "Player cosmetic models in `cosmetics/` (backpacks, masks, hats, hand items). "
            "CC0 1.0 only. Most models come from low-poly packs and authors on Poly Pizza "
            "(Kenney, Quaternius, Kay Lousberg and others), with the CC0 licence checked on "
            "each model page and the original textures and palettes kept. Three items "
            "(life vest, magnifier, megaphone) have no CC0 low-poly equivalent and stay "
            "Poly Haven scans. Four items (rucksack, flashlight, lantern, cardboard box) are "
            "PS1-style low-poly models with native low-resolution bitmap textures from "
            "itch.io packs (Survival PSX and Exploration objects by Elbolilloduro, PSX "
            "Cardboard Boxes by dragon1freak), each page stating CC0."
        )
        lines.append("")
        lines.extend(self.TABLE_HEADER)
        lines.extend(self._rows(cosmetics))
        lines.append("")
        lines.append("## Not fetched — Sketchfab (CC-BY, requires `SKETCHFAB_API_TOKEN`)")
        lines.append("")
        lines.append(
            "The models below were identified as good matches for their prop types but "
            "could not be downloaded because Sketchfab requires an API token and "
            "`SKETCHFAB_API_TOKEN` was not available when this manifest was assembled. "
            "If one of these is ever added, use the credit line in the last column."
        )
        lines.append("")
        lines.append("| Prop type | Title | Author | Sketchfab UID | License | Why it matters | Credit line |")
        lines.append("|---|---|---|---|---|---|---|")
        for item in self.sketchfab:
            credit = f"\"{item.title}\" by {item.author}, licensed CC-BY, via sketchfab.com/3d-models/{item.uid}"
            lines.append(
                f"| `{item.prop_type}` | {item.title} | {item.author} | `{item.uid}` | "
                f"{item.license} | {item.reason} | {credit} |"
            )
        lines.append("")
        lines.append(
            "Run `tools/fetch_models.py` to regenerate the tables (Poly Haven author names "
            "are cached in `tools/.model-cache/authors.json`)."
        )
        lines.append("")
        return "\n".join(lines)


class FootprintsWriter:
    def __init__(self, output_path: Path):
        self.output_path = output_path

    def _entry(self, result) -> dict:
        spec = result.spec
        entry = {
            "model": f"{spec.category}/{spec.prop_type}",
            "asset": spec.asset,
            "scale": spec.scale,
            "scaleY": spec.scale_y,
            "scaleZ": spec.scale_z,
            "yawOffset": spec.yaw_offset,
            "along": result.along,
            "out": result.out,
            "height": result.height,
            "triangles": result.triangles,
        }
        if spec.hinge_node:
            entry["hinge"] = {
                "node": spec.hinge_node,
                "side": spec.hinge_side,
                "openRad": spec.hinge_open_rad,
            }
        return entry

    def write(self, prop_results, pickup_results) -> None:
        props = {
            result.spec.prop_type: self._entry(result)
            for result in sorted(prop_results, key=lambda r: r.spec.prop_type)
        }
        pickups = {
            result.spec.prop_type: self._entry(result)
            for result in sorted(pickup_results, key=lambda r: r.spec.prop_type)
        }
        payload = {
            "generator": "tools/fetch_models.py",
            "subCellMetres": SUB_CELL_METRES,
            "props": props,
            "pickups": pickups,
        }
        self.output_path.parent.mkdir(parents=True, exist_ok=True)
        self.output_path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")


class ModelFetcher:
    def __init__(self, repo_root: Path, force: bool, cosmetics_only: bool = False):
        self.repo_root = repo_root
        self.force = force
        self.cosmetics_only = cosmetics_only
        self.client_dir = repo_root / "client"
        self.cache_dir = repo_root / "tools" / ".model-cache"
        self.output_root = self.client_dir / "public" / "models"
        self.downloader = Downloader(self.cache_dir)
        self.packer = GltfPacker(self.client_dir)
        self.downscaler = TextureDownscaler()
        self.stripper = GltfMaterialStripper()
        self.packs = PackStore(self.cache_dir)
        self.author_cache = AuthorCache(self.cache_dir / "authors.json")
        self.info = PolyHavenInfo(self.downloader, self.author_cache)

    def _print_sketchfab_notice(self) -> None:
        token = os.environ.get("SKETCHFAB_API_TOKEN")
        print("=" * 78)
        if token:
            print("SKETCHFAB_API_TOKEN found, but the Sketchfab downloader is not implemented.")
            print("The following models would be fetched if it were:")
        else:
            print("SKETCHFAB_API_TOKEN not set — skipping these Sketchfab CC-BY models:")
        for item in SKETCHFAB_MANIFEST:
            print(f"  - {item.prop_type}: \"{item.title}\" by {item.author} (uid {item.uid}) — {item.reason}")
        print(f"{len(SKETCHFAB_MANIFEST)} Sketchfab model(s) skipped this run.")
        print("=" * 78)

    def _directory_size(self) -> int:
        return sum(p.stat().st_size for p in self.output_root.rglob("*") if p.is_file())

    def _print_summary(self, results) -> None:
        print()
        print(
            f"{'prop type':20} {'category':12} {'along':>7} {'out':>7} {'height':>7} "
            f"{'tris':>7} {'MB':>7}"
        )
        total_bytes = 0
        for result in sorted(results, key=lambda r: r.spec.prop_type):
            spec = result.spec
            total_bytes += result.bytes_written
            print(
                f"{spec.prop_type:20} {spec.category:12} {result.along:7.3f} {result.out:7.3f} "
                f"{result.height:7.3f} {result.triangles:7d} {result.bytes_written / 1e6:7.3f}"
            )
        print(f"TOTAL (tracked results): {total_bytes / 1e6:.2f} MB across {len(results)} models")
        print(f"Sketchfab models skipped: {len(SKETCHFAB_MANIFEST)}")
        dir_bytes = self._directory_size()
        print(f"client/public/models on-disk size: {dir_bytes / 1e6:.2f} MB (budget: 25 MB)")

    def run(self) -> int:
        self._print_sketchfab_notice()

        results = []
        errors = []
        specs = (
            COSMETIC_MANIFEST if self.cosmetics_only
            else MANIFEST + ITCH_MANIFEST + OPENGAMEART_MANIFEST + PICKUP_MANIFEST + COSMETIC_MANIFEST
        )
        for spec in specs:
            processor = ModelProcessor(
                spec, self.output_root, self.downloader, self.packer, self.downscaler, self.stripper,
                self.packs, self.client_dir,
            )
            try:
                result = processor.process(self.force)
                results.append(result)
                status = "skipped" if result.skipped else "built"
                print(f"[{spec.prop_type}] {status} - {result.triangles} tris, {result.bytes_written} bytes")
            except Exception as error:
                print(f"[{spec.prop_type}] FAILED: {error}", file=sys.stderr)
                errors.append((spec.prop_type, error))

        decoder_path = DecoderInstaller(self.client_dir).install()
        print(f"[decoder] meshopt_decoder.js installed at {decoder_path}")

        license_text = LicenseGenerator(
            MANIFEST + ITCH_MANIFEST + OPENGAMEART_MANIFEST + PICKUP_MANIFEST + COSMETIC_MANIFEST,
            self.info, SKETCHFAB_MANIFEST,
        ).build()
        self.output_root.mkdir(parents=True, exist_ok=True)
        (self.output_root / "LICENSES.md").write_text(license_text, encoding="utf-8")

        if not self.cosmetics_only:
            prop_results = [r for r in results if r.spec.category not in ("pickups", COSMETICS_CATEGORY)]
            pickup_results = [r for r in results if r.spec.category == "pickups"]
            footprints_path = self.client_dir / "src" / "world" / "footprints.json"
            FootprintsWriter(footprints_path).write(prop_results, pickup_results)

        self._print_summary(results)

        if errors:
            print(f"{len(errors)} models failed", file=sys.stderr)
            return 1
        return 0


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--force", action="store_true")
    parser.add_argument("--cosmetics", action="store_true")
    args = parser.parse_args()
    repo_root = Path(__file__).resolve().parent.parent
    return ModelFetcher(repo_root, args.force, args.cosmetics).run()


if __name__ == "__main__":
    sys.exit(main())
