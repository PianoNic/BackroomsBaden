import type { Node } from "@babylonjs/core/node";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { EquippedCosmetics } from "../../src/net/protocol";
import { AmbientLights, createRenderContext, type RenderContext } from "../../src/rendering/renderer";
import { lambertMaterial, plane } from "../../src/rendering/babylon";
import { buildWorld, type World } from "../../src/world/builder";
import { Lockers } from "../../src/gameplay/lockers";
import { Doors } from "../../src/gameplay/doors";
import { Corpses } from "../../src/gameplay/corpses";
import { Chairs } from "../../src/gameplay/chairs";
import { RemotePlayers } from "../../src/gameplay/remotePlayers";
import { CosmeticSlots } from "../../src/gameplay/cosmeticSlots";
import { cosmeticModels } from "../../src/gameplay/cosmeticModels";
import { EyeHeight } from "../../src/gameplay/eyeHeight";
import { ensureCatalog, resolveCosmetic } from "../../src/gameplay/cosmetics";
import { HatSlice } from "../../src/gameplay/hatSlice";
import { LeakProbe } from "./LeakProbe";
import { GalleryLayouts, type Layout } from "./GalleryLayouts";

type Vec3 = [number, number, number];

export type GalleryApi = {
  ready: Promise<void>;
  probe: LeakProbe;
  showRemote(equipped: EquippedCosmetics, yaw?: number, x?: number, z?: number): Promise<void>;
  setHidden(hidden: boolean): void;
  setTagVisible(visible: boolean): void;
  playerSpot(): [number, number];
  showCorpse(equipped: EquippedCosmetics): Promise<void>;
  showHand(equipped: EquippedCosmetics, eyeHeight: number): Promise<void>;
  eyeHeights: { standing: number; crouching: number };
  setCamera(position: Vec3, target: Vec3): void;
  frames(count: number): Promise<void>;
  bounds(): { min: Vec3; max: Vec3; tag: [number, number] | null; tagForward: number; tagBottomRadius: number } | null;
  setLayout(name: string | null): void;
};

class CosmeticGallery implements GalleryApi {
  static readonly SELF_ID = "self";
  static readonly BODY_COLOR = "#a9b4c2";

  readonly eyeHeights = { standing: EyeHeight.STANDING, crouching: EyeHeight.CROUCHING };
  readonly ready: Promise<void>;
  probe!: LeakProbe;
  private ctx!: RenderContext;
  private remotes!: RemotePlayers;
  private corpses!: Corpses;
  private chairs!: Chairs;
  private lights!: AmbientLights;
  private world: World | null = null;
  private lockers: Lockers | null = null;
  private doors: Doors | null = null;
  private layout: Layout | null = null;
  private lastMs = 0;
  private readonly crosshair = document.getElementById("crosshair") as HTMLElement;

  constructor(private readonly mount: HTMLElement) {
    this.ready = this.init();
  }

  private async init(): Promise<void> {
    await ensureCatalog();
    this.ctx = createRenderContext(this.mount);
    const { scene, camera } = this.ctx;
    this.lights = new AmbientLights(scene);
    const floor = plane(200, 200, lambertMaterial(0x6b6a55), true, "galleryFloor");
    floor.rotation.x = -Math.PI / 2;
    this.remotes = new RemotePlayers(camera);
    this.corpses = new Corpses();
    this.probe = new LeakProbe(scene, this.remotes);
    this.chairs = new Chairs(
      [{ id: "chair", x: 500, z: 500, yaw: 0, heldBy: null }],
      CosmeticGallery.SELF_ID, camera, this.remotes, {},
    );
    this.lastMs = performance.now();
    this.ctx.engine.runRenderLoop(() => this.tick());
  }

  private tick(): void {
    const now = performance.now();
    const dt = Math.min(0.1, (now - this.lastMs) / 1000);
    this.lastMs = now;
    this.ctx.ambience.update(dt, 0, 1e9);
    this.lights.update(dt, 1);
    this.remotes.update(dt);
    this.ctx.render();
  }

  setCamera(position: Vec3, target: Vec3): void {
    const { camera } = this.ctx;
    camera.position.set(...position);
    camera.setTarget(new Vector3(...target));
  }

  frames(count: number): Promise<void> {
    return new Promise((resolve) => {
      let left = count;
      const step = (): void => {
        left -= 1;
        if (left <= 0) resolve();
        else requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }

  setLayout(name: string | null): void {
    this.world?.group.dispose(false, false);
    this.lockers?.group.dispose(false, false);
    this.doors?.group.dispose(false, false);
    this.doors = null;
    const tagDoors = this.remotes.attachDoors(GalleryLayouts.CELL);
    this.world = null;
    this.lockers = null;
    this.layout = null;
    if (!name) return;
    this.layout = name === "distant" ? GalleryLayouts.distant() : GalleryLayouts.build(name);
    this.world = buildWorld(this.layout.grid, [], []);
    if (this.layout.door) this.doors = new Doors([this.layout.door], [], tagDoors);
    if (this.layout.locker) this.lockers = new Lockers([this.layout.locker]);
  }

  playerSpot(): [number, number] {
    return this.layout?.player ?? [0, 0];
  }

  setHidden(hidden: boolean): void {
    this.remotes.setVisible("p1", !hidden);
  }

  setTagVisible(visible: boolean): void {
    this.remotes.nameTags.setVisible("p1", visible);
  }

  bounds(): { min: Vec3; max: Vec3; tag: [number, number] | null; tagForward: number; tagBottomRadius: number } | null {
    const body = this.remotes.getMesh("p1");
    const root = body?.getChildren().find((node) => node.name === "cosmetics");
    if (!body || !root) return null;
    const min = new Vector3(Infinity, Infinity, Infinity);
    const max = new Vector3(-Infinity, -Infinity, -Infinity);
    for (const mesh of root.getChildMeshes(false)) {
      if (mesh.getTotalVertices() === 0) continue;
      mesh.computeWorldMatrix(true);
      const box = mesh.getBoundingInfo().boundingBox;
      min.minimizeInPlace(box.minimumWorld);
      max.maximizeInPlace(box.maximumWorld);
    }
    if (!Number.isFinite(min.x)) return null;
    const origin = body.position;
    const tagMesh = this.ctx.scene.getMeshByName("nameTag_p1");
    let tag: [number, number] | null = null;
    let tagForward = 0;
    let tagBottomRadius = 0;
    if (tagMesh) {
      tagForward = Math.hypot(tagMesh.position.x - origin.x, tagMesh.position.z - origin.z);
      tagMesh.computeWorldMatrix(true);
      const tagBox = tagMesh.getBoundingInfo().boundingBox;
      tag = [tagBox.minimumWorld.y - origin.y, tagBox.maximumWorld.y - origin.y];
      tagBottomRadius = HatSlice.maxRadius(body, tagBox.minimumWorld.y);
    }
    return {
      tag, tagForward, tagBottomRadius,
      min: [min.x - origin.x, min.y - origin.y, min.z - origin.z],
      max: [max.x - origin.x, max.y - origin.y, max.z - origin.z],
    };
  }

  private async load(equipped: EquippedCosmetics): Promise<void> {
    const urls = CosmeticSlots.entries(equipped, resolveCosmetic)
      .flatMap((entry) => (entry.source.kind === "model" ? [entry.source.url] : []));
    const held = CosmeticSlots.heldModel(equipped, resolveCosmetic);
    if (held) urls.push(held.url);
    await Promise.all(urls.map((url) => cosmeticModels.load(url)));
    await this.frames(3);
  }

  private clearAll(): void {
    const doomed: Node[] = [];
    const bodies: Node[] = [
      ...this.remotes.ids().flatMap((id) => this.remotes.getMesh(id) ?? []),
      ...this.corpses.group.getChildren(),
    ];
    for (const body of bodies) doomed.push(body, ...body.getDescendants(false));
    for (const id of this.remotes.ids()) this.remotes.remove(id);
    this.corpses.remove("corpse");
    for (const node of doomed) if (!node.isDisposed()) node.dispose();
    this.chairs.applyState({
      type: "chair_state", chairId: "chair", x: 500, z: 500, yaw: 0, heldBy: null,
    });
    this.chairs.setHandItem({});
    this.crosshair.style.display = "none";
  }

  async showRemote(equipped: EquippedCosmetics, yaw = 0, x = 0, z = 0): Promise<void> {
    await this.ready;
    this.clearAll();
    this.remotes.add({
      id: "p1", color: CosmeticGallery.BODY_COLOR, x, z, yaw,
      equipped, name: "Testschueler",
    });
    await this.load(equipped);
  }

  async showCorpse(equipped: EquippedCosmetics): Promise<void> {
    await this.ready;
    this.clearAll();
    this.corpses.add("corpse", 0, 0, CosmeticGallery.BODY_COLOR, equipped);
    for (const node of this.corpses.group.getChildren()) {
      if (node instanceof Mesh) node.rotation.y = 0;
    }
    await this.load(equipped);
  }

  async showHand(equipped: EquippedCosmetics, eyeHeight: number): Promise<void> {
    await this.ready;
    this.clearAll();
    this.chairs.applyState({
      type: "chair_state", chairId: "chair", x: 500, z: 500, yaw: 0,
      heldBy: CosmeticGallery.SELF_ID,
    });
    this.chairs.setHandItem(equipped);
    this.setCamera([0, eyeHeight, 0], [0, eyeHeight, -5]);
    this.crosshair.style.display = "block";
    await this.load(equipped);
  }
}

(window as unknown as { cosmeticGallery: GalleryApi }).cosmeticGallery =
  new CosmeticGallery(document.getElementById("mount") as HTMLElement);
