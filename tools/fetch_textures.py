import argparse
import datetime
import http.cookiejar
import io
import json
import os
import re
import shutil
import sys
import time
import urllib.parse
import urllib.request
import zipfile
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

from PIL import Image, ImageChops

USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"
ALBEDO_FILE = "albedo.webp"
AO_BAKE_STRENGTH = 0.6
FALLBACK_PX = 128
FALLBACK_COLOURS = 32
FALLBACK_ALPHA_LEVELS = 4
BAYER_4X4 = (
    (0, 8, 2, 10),
    (12, 4, 14, 6),
    (3, 11, 1, 9),
    (15, 7, 13, 5),
)
DITHER_SPREAD = 14


@dataclass(frozen=True)
class PackInfo:
    name: str
    author: str
    page_url: str
    zip_name: str
    root: str
    licence: str


PSX_PACK = PackInfo(
    name="PSX Textures - 90 Seamless PS1-Style Textures, 5 Looks",
    author="Francisco Cidade",
    page_url="https://fcidade.itch.io/psx-textures-vol-1",
    zip_name="psx-textures-vol-1-textures.zip",
    root="PSX-Textures",
    licence="CC0 1.0",
)


@dataclass(frozen=True)
class PackSource:
    family: str
    material: str
    look: str = "C_soft"


@dataclass(frozen=True)
class AmbientSource:
    asset_id: str
    zip_format: str
    is_decal: bool = False


@dataclass(frozen=True)
class CategorySpec:
    dir_name: str
    source: object


MANIFEST = (
    CategorySpec("wall_plaster_cream", PackSource("plaster-paper", "Plaster001")),
    CategorySpec("wall_plaster_plain", PackSource("plaster-paper", "Plaster003")),
    CategorySpec("wall_tile_white", PackSource("tiles", "Tiles036")),
    CategorySpec("wall_tile_hex", AmbientSource("Tiles071", "JPG")),
    CategorySpec("wall_concrete", PackSource("concrete-stone", "Concrete034")),
    CategorySpec("dado_tile_green", PackSource("tiles", "Tiles032")),
    CategorySpec("floor_terrazzo", PackSource("tiles", "Tiles074")),
    CategorySpec("floor_lino", PackSource("tiles", "Tiles040")),
    CategorySpec("floor_carpet", PackSource("carpet-fabric", "Carpet016", "A_classic")),
    CategorySpec("floor_stone_tile", PackSource("tiles", "Tiles078")),
    CategorySpec("floor_terrazzo_dark", PackSource("tiles", "Tiles052")),
    CategorySpec("floor_wood", PackSource("wood", "WoodFloor040")),
    CategorySpec("ceiling_tile", PackSource("roofs-ceilings", "OfficeCeiling001")),
    CategorySpec("ceiling_plaster", PackSource("plaster-paper", "Plaster001")),
    CategorySpec("decal_leak", AmbientSource("Leaking005", "PNG", True)),
    CategorySpec("door_wood", PackSource("wood", "Wood058")),
    CategorySpec("door_stall_metal", PackSource("metal", "Metal012")),
)


@dataclass
class CategoryResult:
    dir_name: str
    bytes_written: int
    skipped: bool
    note: str = ""


class Downloader:
    def __init__(self, cache_dir: Path):
        self.cache_dir = cache_dir
        self.cache_dir.mkdir(parents=True, exist_ok=True)

    def fetch(self, url: str, filename: str) -> Path:
        dest = self.cache_dir / filename
        if dest.exists() and dest.stat().st_size > 0:
            return dest
        last_error = None
        for attempt in range(1, 4):
            try:
                request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
                with urllib.request.urlopen(request, timeout=90) as response:
                    data = response.read()
                if not data:
                    raise RuntimeError("empty response body")
                tmp = self.cache_dir / (filename + ".part")
                tmp.write_bytes(data)
                tmp.replace(dest)
                return dest
            except Exception as error:
                last_error = error
                if attempt < 3:
                    time.sleep(2 * attempt)
        raise RuntimeError(f"failed to download {url}: {last_error}")


class ItchDownloader:
    MIN_INTERVAL_S = 6.0

    def __init__(self, page_url: str, cache_dir: Path):
        self.page_url = page_url.rstrip("/")
        self.cache_dir = cache_dir
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        jar = http.cookiejar.CookieJar()
        self.opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
        self.opener.addheaders = [("User-Agent", USER_AGENT)]
        self.last_request = 0.0

    def _throttle(self) -> None:
        remaining = self.MIN_INTERVAL_S - (time.monotonic() - self.last_request)
        if remaining > 0:
            time.sleep(remaining)
        self.last_request = time.monotonic()

    def _text(self, url: str, form: Optional[dict] = None) -> str:
        self._throttle()
        body = urllib.parse.urlencode(form).encode() if form is not None else None
        request = urllib.request.Request(url, data=body, headers={"Referer": self.page_url})
        with self.opener.open(request, timeout=90) as response:
            return response.read().decode("utf-8", "replace")

    @staticmethod
    def _csrf_token(html: str) -> str:
        match = re.search(r'name="csrf_token"\s+value="([^"]+)"', html)
        if match is None:
            match = re.search(r'value="([^"]+)"\s+name="csrf_token"', html)
        if match is None:
            raise RuntimeError("csrf_token not found on itch.io page")
        return match.group(1)

    @staticmethod
    def _upload_id(html: str, filename: str) -> str:
        for block in re.finditer(r'<div class="upload">.*?</div>\s*</div>', html, re.S):
            if filename in block.group(0):
                found = re.search(r'data-upload_id="(\d+)"', block.group(0))
                if found:
                    return found.group(1)
        raise RuntimeError(f"upload {filename} not listed on the itch.io download page")

    def fetch(self, filename: str) -> Path:
        dest = self.cache_dir / filename
        if dest.exists() and dest.stat().st_size > 0:
            return dest
        token = self._csrf_token(self._text(self.page_url + "/purchase"))
        download_url = json.loads(self._text(self.page_url + "/download_url", {"csrf_token": token}))["url"]
        page = self._text(download_url)
        token = self._csrf_token(page)
        upload_id = self._upload_id(page, filename)
        cdn_url = json.loads(self._text(f"{self.page_url}/file/{upload_id}", {"csrf_token": token}))["url"]
        tmp = dest.with_suffix(dest.suffix + ".part")
        self._throttle()
        with self.opener.open(urllib.request.Request(cdn_url), timeout=120) as response, open(tmp, "wb") as out:
            shutil.copyfileobj(response, out)
        if tmp.stat().st_size == 0:
            raise RuntimeError("empty download from itch.io CDN")
        tmp.replace(dest)
        return dest


class PackArchive:
    ALLOWED_SUFFIXES = (".png", ".txt")
    MAX_MEMBER_BYTES = 4 * 1024 * 1024

    def __init__(self, info: PackInfo, zip_path: Path, extract_dir: Path):
        self.info = info
        self.zip_path = zip_path
        self.extract_dir = extract_dir

    def extract(self) -> None:
        if self.extract_dir.exists():
            shutil.rmtree(self.extract_dir)
        self.extract_dir.mkdir(parents=True)
        base = self.extract_dir.resolve()
        with zipfile.ZipFile(self.zip_path) as archive:
            for member in archive.infolist():
                if member.is_dir() or not member.filename.lower().endswith(self.ALLOWED_SUFFIXES):
                    continue
                if member.file_size > self.MAX_MEMBER_BYTES:
                    raise RuntimeError(f"{member.filename}: member too large")
                target = (base / member.filename).resolve()
                if base != target and base not in target.parents:
                    raise RuntimeError(f"{member.filename}: path escapes the extraction directory")
                target.parent.mkdir(parents=True, exist_ok=True)
                with archive.open(member) as source, open(target, "wb") as out:
                    shutil.copyfileobj(source, out)

    def texture_path(self, source: PackSource) -> Path:
        return self.extract_dir / self.info.root / source.look / source.family / f"{source.material}.png"

    def credited_ids(self) -> dict:
        text = (self.extract_dir / self.info.root / "CREDITS.txt").read_text(encoding="utf-8")
        families = {}
        for line in text.splitlines():
            match = re.match(r"^([a-z-]+): (.+)$", line.strip())
            if match:
                families[match.group(1)] = {item.strip() for item in match.group(2).split(",")}
        return families


class AmbientCGAsset:
    URL_TEMPLATE = "https://ambientcg.com/get?file={asset_id}_1K-{fmt}.zip"
    SUFFIXES = {
        "color": "_color",
        "ao": "_ambientocclusion",
        "opacity": "_opacity",
    }

    def __init__(self, source: AmbientSource, downloader: Downloader):
        self.source = source
        self.downloader = downloader

    def load_maps(self) -> dict:
        url = self.URL_TEMPLATE.format(asset_id=self.source.asset_id, fmt=self.source.zip_format)
        zip_path = self.downloader.fetch(url, f"{self.source.asset_id}_1K-{self.source.zip_format}.zip")
        maps = {}
        with zipfile.ZipFile(zip_path) as archive:
            names = archive.namelist()
            for key, suffix in self.SUFFIXES.items():
                for name in names:
                    if os.path.splitext(name)[0].lower().endswith(suffix):
                        maps[key] = Image.open(io.BytesIO(archive.read(name))).copy()
                        break
        return maps


class Ps1Reducer:
    @staticmethod
    def _dither(image: Image.Image) -> Image.Image:
        pixels = image.load()
        width, height = image.size
        for y in range(height):
            for x in range(width):
                offset = round((BAYER_4X4[y % 4][x % 4] / 15.0 - 0.5) * DITHER_SPREAD)
                r, g, b = pixels[x, y]
                pixels[x, y] = (
                    max(0, min(255, r + offset)),
                    max(0, min(255, g + offset)),
                    max(0, min(255, b + offset)),
                )
        return image

    @staticmethod
    def _quantise(image: Image.Image) -> Image.Image:
        paletted = image.quantize(colors=FALLBACK_COLOURS, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
        return paletted.convert("RGB")

    @classmethod
    def opaque(cls, color: Image.Image, ao: Optional[Image.Image]) -> Image.Image:
        base = color.convert("RGB").resize((FALLBACK_PX, FALLBACK_PX), Image.BOX)
        if ao is not None:
            occlusion = ao.convert("L").resize((FALLBACK_PX, FALLBACK_PX), Image.BOX)
            factor = occlusion.point(
                lambda v: max(0, min(255, round(255 * (1.0 - AO_BAKE_STRENGTH * (1.0 - v / 255.0)))))
            )
            base = ImageChops.multiply(base, Image.merge("RGB", (factor, factor, factor)))
        return cls._quantise(cls._dither(base))

    @classmethod
    def decal(cls, color: Image.Image, opacity: Image.Image) -> Image.Image:
        rgb = cls._quantise(cls._dither(color.convert("RGB").resize((FALLBACK_PX, FALLBACK_PX), Image.BOX)))
        step = 255 / (FALLBACK_ALPHA_LEVELS - 1)
        alpha = opacity.convert("L").resize((FALLBACK_PX, FALLBACK_PX), Image.BOX)
        alpha = alpha.point(lambda v: round(round(v / step) * step))
        r, g, b = rgb.split()
        return Image.merge("RGBA", (r, g, b, alpha))


class CategoryProcessor:
    def __init__(self, spec: CategorySpec, output_root: Path, downloader: Downloader, pack: PackArchive):
        self.spec = spec
        self.output_dir = output_root / spec.dir_name
        self.downloader = downloader
        self.pack = pack

    def is_complete(self) -> bool:
        return (self.output_dir / ALBEDO_FILE).exists()

    def _pack_image(self, source: PackSource) -> Image.Image:
        credited = self.pack.credited_ids().get(source.family, set())
        if source.material not in credited:
            raise RuntimeError(f"{source.material} is not credited under {source.family} in CREDITS.txt")
        return Image.open(self.pack.texture_path(source)).convert("RGB")

    def _ambient_image(self, source: AmbientSource) -> Image.Image:
        maps = AmbientCGAsset(source, self.downloader).load_maps()
        color = maps.get("color")
        if color is None:
            raise RuntimeError(f"{source.asset_id}: missing Color map")
        if source.is_decal:
            opacity = maps.get("opacity")
            if opacity is None:
                raise RuntimeError(f"{source.asset_id}: missing Opacity map for decal")
            return Ps1Reducer.decal(color, opacity)
        return Ps1Reducer.opaque(color, maps.get("ao"))

    def process(self, force: bool) -> CategoryResult:
        if not force and self.is_complete():
            size = (self.output_dir / ALBEDO_FILE).stat().st_size
            return CategoryResult(self.spec.dir_name, size, True)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        source = self.spec.source
        if isinstance(source, PackSource):
            image = self._pack_image(source)
            note = f"pack {source.look}/{source.family}/{source.material}"
        else:
            image = self._ambient_image(source)
            note = f"fallback ambientCG {source.asset_id}"
        path = self.output_dir / ALBEDO_FILE
        image.save(path, "WEBP", lossless=True, method=6)
        return CategoryResult(self.spec.dir_name, path.stat().st_size, False, note)


class LicenseGenerator:
    LOOK_DESCRIPTIONS = {
        "A_classic": "64 px, 16 colours, PS1 dither",
        "C_soft": "128 px, 32 colours, light dither",
    }

    def __init__(self, manifest, pack_info: PackInfo, fetch_date: str):
        self.manifest = manifest
        self.pack_info = pack_info
        self.fetch_date = fetch_date

    def build(self) -> str:
        info = self.pack_info
        lines = [
            "# Texture Licenses",
            "",
            "Every texture in this directory is CC0 1.0 / public domain and requires no attribution to use, "
            "modify or redistribute; the tables below are provided for traceability only.",
            "",
            f"## {info.name}",
            "",
            f"By {info.author}, {info.page_url}, licence {info.licence} (text in the pack's `LICENSE.txt`). "
            "The pack's source materials are ambientCG, also CC0 1.0; the ambientCG material id of each "
            "texture is its file name in the pack, as listed in the pack's `CREDITS.txt`.",
            "",
            "| Category | Pack texture | Look | ambientCG material | Pack page | Licence | Fetched |",
            "|---|---|---|---|---|---|---|",
        ]
        for spec in self.manifest:
            if isinstance(spec.source, PackSource):
                s = spec.source
                look = f"{s.look} ({self.LOOK_DESCRIPTIONS[s.look]})"
                ambient = f"[{s.material}](https://ambientcg.com/a/{s.material})"
                lines.append(
                    f"| `{spec.dir_name}` | {s.look}/{s.family}/{s.material}.png | {look} | {ambient} | "
                    f"{info.page_url} | {info.licence} | {self.fetch_date} |"
                )
        fallbacks = [spec for spec in self.manifest if isinstance(spec.source, AmbientSource)]
        lines += [
            "",
            "## ambientCG fallbacks",
            "",
            "The pack has no suitable texture for these categories, so they come straight from ambientCG "
            f"(1K download) and are reduced to the pack's look: downscaled to {FALLBACK_PX} px, "
            f"{FALLBACK_COLOURS} colours, 4x4 ordered dither, decal alpha posterised to "
            f"{FALLBACK_ALPHA_LEVELS} levels.",
            "",
            "| Category | ambientCG material | Source URL | Source | Licence | Fetched |",
            "|---|---|---|---|---|---|",
        ]
        for spec in fallbacks:
            a = spec.source
            lines.append(
                f"| `{spec.dir_name}` | {a.asset_id} | https://ambientcg.com/view?id={a.asset_id} | "
                f"ambientCG | CC0 1.0 | {self.fetch_date} |"
            )
        lines += [
            "",
            "## File layout",
            "",
            f"Each category directory holds a single `{ALBEDO_FILE}` (lossless WebP, RGBA for `decal_leak`, "
            "RGB for the rest). Pack textures are copied through unchanged.",
            "",
            "Run `tools/fetch_textures.py` to regenerate this entire tree.",
            "",
        ]
        return "\n".join(lines)


class TextureFetcher:
    def __init__(self, repo_root: Path, force: bool):
        self.repo_root = repo_root
        self.force = force
        self.output_root = repo_root / "client" / "public" / "textures" / "surfaces"
        self.cache_dir = repo_root / "tools" / ".texture-cache"
        self.downloader = Downloader(self.cache_dir)

    def run(self) -> int:
        zip_path = ItchDownloader(PSX_PACK.page_url, self.cache_dir).fetch(PSX_PACK.zip_name)
        pack = PackArchive(PSX_PACK, zip_path, self.cache_dir / "psx-pack")
        pack.extract()
        errors = []
        for spec in MANIFEST:
            processor = CategoryProcessor(spec, self.output_root, self.downloader, pack)
            try:
                result = processor.process(self.force)
                status = "skipped" if result.skipped else "built"
                print(f"[{spec.dir_name}] {status} - {result.bytes_written} bytes {result.note}".rstrip())
            except Exception as error:
                print(f"[{spec.dir_name}] FAILED: {error}", file=sys.stderr)
                errors.append((spec.dir_name, error))

        license_text = LicenseGenerator(MANIFEST, PSX_PACK, datetime.date.today().isoformat()).build()
        self.output_root.mkdir(parents=True, exist_ok=True)
        (self.output_root / "LICENSES.md").write_text(license_text, encoding="utf-8")

        total_bytes = sum(f.stat().st_size for f in self.output_root.rglob("*") if f.is_file())
        print(f"TOTAL: {total_bytes} bytes ({total_bytes / 1024 / 1024:.2f} MB) under {self.output_root}")
        if errors:
            print(f"{len(errors)} categories failed", file=sys.stderr)
            return 1
        return 0


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()
    repo_root = Path(__file__).resolve().parent.parent
    return TextureFetcher(repo_root, args.force).run()


if __name__ == "__main__":
    sys.exit(main())
