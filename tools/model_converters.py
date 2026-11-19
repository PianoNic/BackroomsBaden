import base64
import json
import math
import struct
from pathlib import Path

from PIL import Image

GLB_MAGIC = b"glTF"
JSON_CHUNK = 0x4E4F534A
BIN_CHUNK = 0x004E4942
IMAGE_EXTENSIONS = {"image/png": "png", "image/jpeg": "jpg"}


class GlbUnpacker:
    def unpack(self, glb: Path, out_dir: Path, stem: str) -> Path:
        data = glb.read_bytes()
        if data[:4] != GLB_MAGIC:
            raise RuntimeError(f"{glb} is not a binary glTF")
        document, binary = self._chunks(data)
        out_dir.mkdir(parents=True, exist_ok=True)
        (out_dir / f"{stem}.bin").write_bytes(binary)
        document["buffers"] = [{"uri": f"{stem}.bin", "byteLength": len(binary)}]
        for index, image in enumerate(document.get("images", [])):
            payload, extension = self._image_payload(image, document, binary)
            name = f"{stem}_{index}.{extension}"
            (out_dir / name).write_bytes(payload)
            for key in ("bufferView", "mimeType"):
                image.pop(key, None)
            image["uri"] = name
        target = out_dir / f"{stem}.gltf"
        target.write_text(json.dumps(document), encoding="utf-8")
        return target

    @staticmethod
    def _chunks(data: bytes) -> tuple[dict, bytes]:
        document = {}
        binary = b""
        offset = 12
        while offset < len(data):
            length, kind = struct.unpack_from("<II", data, offset)
            chunk = data[offset + 8: offset + 8 + length]
            if kind == JSON_CHUNK:
                document = json.loads(chunk.decode("utf-8"))
            elif kind == BIN_CHUNK:
                binary = bytes(chunk)
            offset += 8 + length + ((4 - length % 4) % 4)
        return document, binary

    @staticmethod
    def _image_payload(image: dict, document: dict, binary: bytes) -> tuple[bytes, str]:
        if "bufferView" in image:
            view = document["bufferViews"][image["bufferView"]]
            start = view.get("byteOffset", 0)
            payload = binary[start: start + view["byteLength"]]
            return payload, IMAGE_EXTENSIONS.get(image.get("mimeType", "image/png"), "png")
        uri = image.get("uri", "")
        if uri.startswith("data:"):
            header, encoded = uri.split(",", 1)
            mime = header[5:].split(";")[0]
            return base64.b64decode(encoded), IMAGE_EXTENSIONS.get(mime, "png")
        raise RuntimeError("external image references are not supported in a GLB")


class ObjMaterial:
    def __init__(self, name: str):
        self.name = name
        self.diffuse = (1.0, 1.0, 1.0)
        self.texture: str | None = None


class ObjToGltf:
    texture_override: str | None = None

    def convert(self, obj: Path, out_dir: Path, stem: str, texture: str | None = None) -> Path:
        self.texture_override = texture
        out_dir.mkdir(parents=True, exist_ok=True)
        positions, uvs, normals = [], [], []
        groups: dict[str, list] = {}
        current = ""
        materials = {}
        for raw in obj.read_text(encoding="utf-8", errors="replace").splitlines():
            parts = raw.split()
            if not parts or parts[0].startswith("#"):
                continue
            tag = parts[0]
            if tag == "v":
                positions.append(tuple(float(x) for x in parts[1:4]))
            elif tag == "vt":
                uvs.append((float(parts[1]), float(parts[2])))
            elif tag == "vn":
                normals.append(tuple(float(x) for x in parts[1:4]))
            elif tag == "mtllib":
                materials.update(self._read_mtl(obj.parent / " ".join(parts[1:])))
            elif tag == "usemtl":
                current = " ".join(parts[1:])
            elif tag == "f":
                groups.setdefault(current, []).append(parts[1:])
        return self._write(out_dir, stem, obj.parent, positions, uvs, normals, groups, materials)

    @staticmethod
    def _read_mtl(path: Path) -> dict:
        materials: dict[str, ObjMaterial] = {}
        if not path.is_file():
            return materials
        active = None
        for raw in path.read_text(encoding="utf-8", errors="replace").splitlines():
            parts = raw.split()
            if not parts:
                continue
            if parts[0] == "newmtl":
                active = ObjMaterial(" ".join(parts[1:]))
                materials[active.name] = active
            elif active is not None and parts[0] == "Kd" and len(parts) >= 4:
                active.diffuse = tuple(float(x) for x in parts[1:4])
            elif active is not None and parts[0] == "map_Kd":
                active.texture = " ".join(parts[1:]).replace("\\", "/").split("/")[-1]
        return materials

    @staticmethod
    def _resolve(ref: str, count: int) -> int:
        index = int(ref)
        return index - 1 if index > 0 else count + index

    def _write(self, out_dir, stem, source_dir, positions, uvs, normals, groups, materials) -> Path:
        buffer = bytearray()
        views, accessors, primitives, gltf_materials, textures, images = [], [], [], [], [], []
        texture_index: dict[str, int] = {}

        def add_view(payload: bytes, target: int | None) -> int:
            while len(buffer) % 4:
                buffer.append(0)
            view = {"buffer": 0, "byteOffset": len(buffer), "byteLength": len(payload)}
            if target:
                view["target"] = target
            buffer.extend(payload)
            views.append(view)
            return len(views) - 1

        for name, faces in groups.items():
            vertex_ids: dict[tuple, int] = {}
            pos_out, nrm_out, uv_out, indices = [], [], [], []
            for face in faces:
                corners = []
                for token in face:
                    refs = token.split("/")
                    vi = self._resolve(refs[0], len(positions))
                    ti = self._resolve(refs[1], len(uvs)) if len(refs) > 1 and refs[1] else None
                    ni = self._resolve(refs[2], len(normals)) if len(refs) > 2 and refs[2] else None
                    key = (vi, ti, ni)
                    if key not in vertex_ids:
                        vertex_ids[key] = len(pos_out)
                        pos_out.append(positions[vi])
                        nrm_out.append(normals[ni] if ni is not None else (0.0, 1.0, 0.0))
                        uv = uvs[ti] if ti is not None else (0.0, 0.0)
                        uv_out.append((uv[0], 1.0 - uv[1]))
                    corners.append(vertex_ids[key])
                for k in range(1, len(corners) - 1):
                    indices.extend((corners[0], corners[k], corners[k + 1]))
            flat_pos = [c for p in pos_out for c in p]
            attributes = {}
            for semantic, data, kind in (
                ("POSITION", flat_pos, "VEC3"),
                ("NORMAL", [c for n in nrm_out for c in n], "VEC3"),
                ("TEXCOORD_0", [c for u in uv_out for c in u], "VEC2"),
            ):
                view = add_view(struct.pack(f"<{len(data)}f", *data), 34962)
                accessor = {
                    "bufferView": view, "componentType": 5126, "count": len(pos_out), "type": kind,
                }
                if semantic == "POSITION":
                    accessor["min"] = [min(flat_pos[i::3]) for i in range(3)]
                    accessor["max"] = [max(flat_pos[i::3]) for i in range(3)]
                accessors.append(accessor)
                attributes[semantic] = len(accessors) - 1
            view = add_view(struct.pack(f"<{len(indices)}I", *indices), 34963)
            accessors.append({"bufferView": view, "componentType": 5125, "count": len(indices), "type": "SCALAR"})
            material = materials.get(name) or ObjMaterial(name or "default")
            if self.texture_override:
                material.texture = self.texture_override
            pbr = {"baseColorFactor": [*material.diffuse, 1.0], "metallicFactor": 0.0, "roughnessFactor": 1.0}
            if material.texture:
                if material.texture not in texture_index:
                    png_name = self._texture_file(source_dir, material.texture, out_dir, stem, len(images))
                    images.append({"uri": png_name})
                    textures.append({"source": len(images) - 1})
                    texture_index[material.texture] = len(textures) - 1
                pbr["baseColorTexture"] = {"index": texture_index[material.texture]}
                pbr["baseColorFactor"] = [1.0, 1.0, 1.0, 1.0]
            gltf_materials.append({"name": material.name, "pbrMetallicRoughness": pbr, "doubleSided": True})
            primitives.append({
                "attributes": attributes, "indices": len(accessors) - 1, "material": len(gltf_materials) - 1,
            })

        (out_dir / f"{stem}.bin").write_bytes(bytes(buffer))
        document = {
            "asset": {"version": "2.0", "generator": "tools/model_converters.py"},
            "scene": 0,
            "scenes": [{"nodes": [0]}],
            "nodes": [{"name": stem, "mesh": 0}],
            "meshes": [{"primitives": primitives}],
            "materials": gltf_materials,
            "buffers": [{"uri": f"{stem}.bin", "byteLength": len(buffer)}],
            "bufferViews": views,
            "accessors": accessors,
        }
        if images:
            document["images"] = images
            document["textures"] = textures
        target = out_dir / f"{stem}.gltf"
        target.write_text(json.dumps(document), encoding="utf-8")
        return target

    @staticmethod
    def _texture_file(source_dir: Path, name: str, out_dir: Path, stem: str, index: int) -> str:
        source = source_dir / name
        if not source.is_file():
            matches = [p for p in source_dir.iterdir() if p.stem.lower() == Path(name).stem.lower()]
            if not matches:
                raise RuntimeError(f"texture {name} not found next to the OBJ")
            source = matches[0]
        image = Image.open(source)
        image.load()
        target = f"{stem}_tex{index}.png"
        image.convert("RGBA" if "A" in image.getbands() else "RGB").save(out_dir / target)
        return target


class SceneEditor:
    def edit(self, gltf: Path, node: str | None, yaw: float) -> None:
        document = json.loads(gltf.read_text(encoding="utf-8"))
        scene = document["scenes"][document.get("scene", 0)]
        if node:
            self._keep_only(document, scene, node)
        if yaw:
            half = yaw / 2.0
            document["nodes"].append({
                "name": "pre_yaw",
                "rotation": [0.0, math.sin(half), 0.0, math.cos(half)],
                "children": list(scene["nodes"]),
            })
            scene["nodes"] = [len(document["nodes"]) - 1]
        gltf.write_text(json.dumps(document), encoding="utf-8")

    def _keep_only(self, document: dict, scene: dict, name: str) -> None:
        nodes = document["nodes"]
        chain = self._find(nodes, scene["nodes"], name, [])
        if chain is None:
            raise RuntimeError(f"node {name} not found in the source model")
        scene["nodes"] = [chain[0]]
        for parent, child in zip(chain, chain[1:]):
            nodes[parent]["children"] = [child]
        kept = set()
        self._collect(nodes, chain[-1], kept)
        kept.update(chain)
        for index, entry in enumerate(nodes):
            if index not in kept:
                for key in ("mesh", "children", "skin"):
                    entry.pop(key, None)

    def _collect(self, nodes: list, index: int, kept: set) -> None:
        kept.add(index)
        for child in nodes[index].get("children", []):
            self._collect(nodes, child, kept)

    def _find(self, nodes: list, candidates: list, name: str, trail: list):
        for index in candidates:
            path = trail + [index]
            if nodes[index].get("name") == name:
                return path
            found = self._find(nodes, nodes[index].get("children", []), name, path)
            if found:
                return found
        return None


class SkinRestPose:
    TOLERANCE = 1e-4
    IDENTITY = tuple(1.0 if i % 5 == 0 else 0.0 for i in range(16))

    def __init__(self, document: dict, binary: bytes):
        self.document = document
        self.binary = binary
        nodes = document["nodes"]
        self.parents = {child: index for index, node in enumerate(nodes) for child in node.get("children", [])}

    @staticmethod
    def _multiply(a: tuple, b: tuple) -> tuple:
        return tuple(
            sum(a[row + k * 4] * b[k + col * 4] for k in range(4))
            for col in range(4) for row in range(4)
        )

    @staticmethod
    def _local(node: dict) -> tuple:
        if "matrix" in node:
            return tuple(node["matrix"])
        tx, ty, tz = node.get("translation", (0.0, 0.0, 0.0))
        qx, qy, qz, qw = node.get("rotation", (0.0, 0.0, 0.0, 1.0))
        sx, sy, sz = node.get("scale", (1.0, 1.0, 1.0))
        return (
            (1 - 2 * (qy * qy + qz * qz)) * sx, (2 * (qx * qy + qz * qw)) * sx, (2 * (qx * qz - qy * qw)) * sx, 0.0,
            (2 * (qx * qy - qz * qw)) * sy, (1 - 2 * (qx * qx + qz * qz)) * sy, (2 * (qy * qz + qx * qw)) * sy, 0.0,
            (2 * (qx * qz + qy * qw)) * sz, (2 * (qy * qz - qx * qw)) * sz, (1 - 2 * (qx * qx + qy * qy)) * sz, 0.0,
            tx, ty, tz, 1.0,
        )

    def world(self, index: int) -> tuple:
        matrix = self._local(self.document["nodes"][index])
        while index in self.parents:
            index = self.parents[index]
            matrix = self._multiply(self._local(self.document["nodes"][index]), matrix)
        return matrix

    def _inverse_binds(self, skin: dict) -> list[tuple]:
        accessor = self.document["accessors"][skin["inverseBindMatrices"]]
        view = self.document["bufferViews"][accessor["bufferView"]]
        start = view.get("byteOffset", 0) + accessor.get("byteOffset", 0)
        count = accessor["count"]
        values = struct.unpack_from(f"<{count * 16}f", self.binary, start)
        return [values[i * 16:(i + 1) * 16] for i in range(count)]

    def verify(self, skin: dict, mesh_node: int) -> float:
        worst = max(abs(a - b) for a, b in zip(self.world(mesh_node), self.IDENTITY))
        for joint, inverse in zip(skin["joints"], self._inverse_binds(skin)):
            product = self._multiply(self.world(joint), inverse)
            worst = max(worst, max(abs(a - b) for a, b in zip(product, self.IDENTITY)))
        if worst > self.TOLERANCE:
            raise RuntimeError(f"rest pose differs from the bind pose by {worst:.6f}")
        return worst


class StaticPoseBaker:
    DROPPED_ATTRIBUTES = ("JOINTS_0", "WEIGHTS_0", "COLOR_0", "COLOR_1")

    def bake(self, gltf: Path, texture: Path | None) -> float:
        document = json.loads(gltf.read_text(encoding="utf-8"))
        binary = (gltf.parent / document["buffers"][0]["uri"]).read_bytes()
        skinned = [i for i, node in enumerate(document["nodes"]) if "skin" in node and "mesh" in node]
        if len(skinned) != 1:
            raise RuntimeError(f"expected one skinned mesh node, found {len(skinned)}")
        index = skinned[0]
        node = document["nodes"][index]
        skin = document["skins"][node["skin"]]
        deviation = SkinRestPose(document, binary).verify(skin, index)
        for primitive in document["meshes"][node["mesh"]]["primitives"]:
            for name in self.DROPPED_ATTRIBUTES:
                primitive["attributes"].pop(name, None)
        document["nodes"] = [{"name": node.get("name", "body"), "mesh": node["mesh"]}]
        document["scenes"][document.get("scene", 0)]["nodes"] = [0]
        document["meshes"] = [document["meshes"][node["mesh"]]]
        document["nodes"][0]["mesh"] = 0
        for key in ("skins", "animations"):
            document.pop(key, None)
        if texture is not None:
            self._bind(document, gltf.parent, texture)
        gltf.write_text(json.dumps(document), encoding="utf-8")
        return deviation

    @staticmethod
    def _bind(document: dict, folder: Path, texture: Path) -> None:
        target = folder / texture.name
        if target != texture:
            target.write_bytes(texture.read_bytes())
        document["images"] = [{"uri": texture.name}]
        document["samplers"] = [{"magFilter": 9728, "minFilter": 9728, "wrapS": 10497, "wrapT": 10497}]
        document["textures"] = [{"sampler": 0, "source": 0}]
        for material in document["materials"]:
            pbr = material.setdefault("pbrMetallicRoughness", {})
            pbr["baseColorTexture"] = {"index": 0, "texCoord": 0}
            pbr["baseColorFactor"] = [1.0, 1.0, 1.0, 1.0]
