import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import type { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { EquippedCosmetics } from "../net/protocol";
import { Mesh, StandardMaterial, activeScene, group, plane } from "../rendering/babylon";
import { resolveCosmetic } from "./cosmetics";
import { NameTagPlacement } from "./nameTagPlacement";
import { parseTitleRef, rarityColor } from "./cosmeticStyle";
import { TitleLegibility } from "./titleLegibility";

const TEX_W = 512;
const TEX_H = 168;
const PLANE_W = 2.4;
const PLANE_H = PLANE_W * (TEX_H / TEX_W);
const CLEARANCE = 0.28;
const FALLBACK_TOP = 1.15;
const CULL_DIST = 12;
const CULL_DIST_SQ = CULL_DIST * CULL_DIST;

type Tag = {
  mesh: Mesh;
  tex: DynamicTexture;
  material: StandardMaterial;
  lastKey: string;
  inRange: boolean;
  hiddenByOwner: boolean;
  top: number;
};

export class NameTags {
  readonly group = group("nameTags");
  private readonly tags = new Map<string, Tag>();

  set(id: string, name: string, equipped: EquippedCosmetics, owner: Mesh): void {
    let tag = this.tags.get(id);
    if (!tag) tag = this.create(id);
    this.refreshOffset(tag, owner);
    this.redraw(tag, name, equipped);
  }

  remove(id: string): void {
    const tag = this.tags.get(id);
    if (!tag) return;
    this.group.remove(tag.mesh);
    tag.mesh.dispose(false, true);
    tag.tex.dispose();
    tag.material.dispose();
    this.tags.delete(id);
  }

  setVisible(id: string, visible: boolean): void {
    const tag = this.tags.get(id);
    if (!tag) return;
    tag.hiddenByOwner = !visible;
    tag.mesh.setEnabled(visible && tag.inRange);
  }

  update(
    cameraPosition: Vector3, resolveMeshPosition: (id: string) => Vector3 | null,
  ): void {
    for (const [id, tag] of this.tags) {
      if (tag.hiddenByOwner) continue;
      const pos = resolveMeshPosition(id);
      if (!pos) continue;
      const dx = pos.x - cameraPosition.x;
      const dy = pos.y - cameraPosition.y;
      const dz = pos.z - cameraPosition.z;
      const inRange = dx * dx + dy * dy + dz * dz <= CULL_DIST_SQ;
      if (inRange !== tag.inRange) {
        tag.inRange = inRange;
        tag.mesh.setEnabled(inRange);
      }
      if (!inRange) continue;
      const placed = NameTagPlacement.place(pos.y + tag.top, PLANE_H, CLEARANCE);
      tag.mesh.position.set(pos.x, placed.centerY, pos.z);
      if (tag.mesh.scaling.x !== placed.scale) tag.mesh.scaling.setAll(placed.scale);
    }
  }

  dispose(): void {
    for (const id of [...this.tags.keys()]) this.remove(id);
  }

  private create(id: string): Tag {
    const tex = new DynamicTexture(
      "nameTag", { width: TEX_W, height: TEX_H }, activeScene(), true,
    );
    tex.hasAlpha = true;
    tex.vScale = -1;
    tex.vOffset = 1;
    const material = new StandardMaterial(`nameTagMat_${id}`, activeScene());
    material.diffuseTexture = tex;
    material.useAlphaFromDiffuseTexture = true;
    material.emissiveTexture = tex;
    material.disableLighting = true;
    material.backFaceCulling = false;
    const mesh = plane(PLANE_W, PLANE_H, material, false, `nameTag_${id}`);
    mesh.billboardMode = Mesh.BILLBOARDMODE_ALL;
    mesh.isPickable = false;
    mesh.setEnabled(false);
    this.group.add(mesh);
    const tag: Tag = {
      mesh, tex, material, lastKey: "", inRange: false, hiddenByOwner: false,
      top: FALLBACK_TOP,
    };
    this.tags.set(id, tag);
    return tag;
  }

  private refreshOffset(tag: Tag, owner: Mesh): void {
    let top = 0;
    try {
      top = owner.getHierarchyBoundingVectors(true).max.y - owner.position.y;
    } catch {
      top = 0;
    }
    tag.top = top > 0 ? top : FALLBACK_TOP;
  }

  private redraw(tag: Tag, name: string, equipped: EquippedCosmetics): void {
    const titleId = equipped.title ?? "";
    const key = `${name}|${titleId}`;
    if (key === tag.lastKey) return;
    tag.lastKey = key;
    const item = titleId ? resolveCosmetic(titleId) : undefined;
    const title = item ? parseTitleRef(item.assetRef) : null;
    drawNameTag(tag.tex, name, title, rarityColor(item?.rarity));
  }
}

function drawNameTag(
  tex: DynamicTexture,
  name: string,
  title: { text: string; color: string } | null,
  accent: string,
): void {
  const ctx = tex.getContext() as CanvasRenderingContext2D;
  ctx.clearRect(0, 0, TEX_W, TEX_H);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const nameY = title ? TEX_H * 0.33 : TEX_H * 0.5;
  ctx.font = "bold 88px sans-serif";
  ctx.lineWidth = 12;
  ctx.strokeStyle = "rgba(0,0,0,0.85)";
  ctx.strokeText(name, TEX_W / 2, nameY, TEX_W - 24);
  ctx.fillStyle = "#ffffff";
  ctx.fillText(name, TEX_W / 2, nameY, TEX_W - 24);

  if (title) {
    const titleY = TEX_H * 0.74;
    ctx.font = "bold 70px sans-serif";
    ctx.lineWidth = 6;
    ctx.strokeStyle = "rgba(0,0,0,0.85)";
    ctx.strokeText(title.text, TEX_W / 2, titleY, TEX_W - 24);
    ctx.fillStyle = TitleLegibility.legible(title.color);
    ctx.fillText(title.text, TEX_W / 2, titleY, TEX_W - 24);
    const half = ctx.measureText(title.text).width / 2;
    ctx.fillStyle = accent;
    ctx.fillRect(TEX_W / 2 - half, titleY + 36, half * 2, 5);
  }

  tex.update(false);
}
