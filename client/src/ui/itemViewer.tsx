/** Tiny Babylon viewer used in the tutorial showcase. Every mounted
 *  ItemViewer shares one pooled offscreen WebGL context (one Engine,
 *  one Scene) instead of creating its own, so mounting many tiles at
 *  once stays under the browser's per-page WebGL context budget. Each
 *  viewer gets its own camera and layer mask into the shared scene and
 *  blits the shared render into its own 2D canvas every frame. The
 *  pool is created on first mount and disposed once the last viewer
 *  using it unmounts. */
import { useEffect, useRef } from "preact/hooks";
import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { FreeCamera } from "@babylonjs/core/Cameras/freeCamera";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import type { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { Group, setCameraOrientation, withScene } from "../rendering/babylon";

interface PoolEntry {
  wrapper: Group;
  camera: FreeCamera;
  canvas: HTMLCanvasElement;
}

interface ViewerPool {
  canvas: HTMLCanvasElement;
  engine: Engine;
  scene: Scene;
  entries: Map<number, PoolEntry>;
  nextId: number;
  nextMask: number;
  raf: number;
  last: number;
}

let pool: ViewerPool | null = null;

function tick(now: number): void {
  const p = pool;
  if (!p) return;
  const dt = (now - p.last) / 1000;
  p.last = now;
  for (const entry of p.entries.values()) {
    entry.wrapper.rotation.y += dt * 0.9;
  }
  for (const entry of p.entries.values()) {
    p.scene.activeCamera = entry.camera;
    p.scene.render();
    const ctx = entry.canvas.getContext("2d");
    if (!ctx) continue;
    ctx.clearRect(0, 0, entry.canvas.width, entry.canvas.height);
    ctx.drawImage(p.canvas, 0, 0, entry.canvas.width, entry.canvas.height);
  }
  p.raf = requestAnimationFrame(tick);
}

function acquirePool(size: number, dpr: number): ViewerPool {
  if (pool) return pool;

  const canvas = document.createElement("canvas");
  canvas.width = size * dpr;
  canvas.height = size * dpr;

  const engine = new Engine(canvas, true, { alpha: true, stencil: false }, false);
  engine.setSize(size * dpr, size * dpr);

  const scene = new Scene(engine);
  scene.useRightHandedSystem = true;
  scene.clearColor = new Color4(0, 0, 0, 0);

  const ambient = new HemisphericLight("amb", new Vector3(0, 1, 0), scene);
  ambient.diffuse = Color3.White();
  ambient.groundColor = Color3.White();
  ambient.specular = Color3.Black();
  ambient.intensity = 0.65;
  const dir = new DirectionalLight("dir", new Vector3(-2, -3, -2).normalize(), scene);
  dir.diffuse = Color3.White();
  dir.specular = Color3.Black();
  dir.intensity = 0.9;

  pool = {
    canvas, engine, scene,
    entries: new Map(),
    nextId: 0,
    nextMask: 0,
    raf: 0,
    last: performance.now(),
  };
  pool.raf = requestAnimationFrame(tick);
  return pool;
}

function releasePool(): void {
  if (!pool) return;
  cancelAnimationFrame(pool.raf);
  pool.scene.dispose();
  pool.engine.dispose();
  pool = null;
}

export function ItemViewer(props: {
  build: () => TransformNode;
  size?: number;
  class?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const size = props.size ?? 140;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio, 2);
    canvas.width = size * dpr;
    canvas.height = size * dpr;

    const p = acquirePool(size, dpr);
    const id = p.nextId++;
    const mask = 1 << (p.nextMask++ % 30);

    const wrapper = new Group("viewerWrapper", p.scene);
    const model = withScene(p.scene, props.build);
    model.parent = wrapper;
    wrapper.computeWorldMatrix(true);

    const bounds = wrapper.getHierarchyBoundingVectors(true);
    const cx = (bounds.min.x + bounds.max.x) / 2;
    const cy = (bounds.min.y + bounds.max.y) / 2;
    const cz = (bounds.min.z + bounds.max.z) / 2;
    const span = bounds.max.subtract(bounds.min).length();
    model.position.set(
      model.position.x - cx, model.position.y - cy, model.position.z - cz,
    );

    for (const mesh of wrapper.getChildMeshes(false)) {
      mesh.layerMask = mask;
    }
    if (model instanceof AbstractMesh) {
      model.layerMask = mask;
    }

    const camera = new FreeCamera(`viewer${id}`, new Vector3(0, 0, 0), p.scene);
    camera.fov = (35 * Math.PI) / 180;
    camera.minZ = 0.05;
    camera.maxZ = 100;
    camera.inputs.clear();
    const dist = Math.max(span * 1.5, 0.9);
    const camY = span * 0.35;
    camera.position.set(0, camY, dist);
    setCameraOrientation(camera, 0, Math.atan2(-camY, dist));
    camera.layerMask = mask;

    p.entries.set(id, { wrapper, camera, canvas });

    return () => {
      p.entries.delete(id);
      camera.dispose();
      wrapper.dispose();
      if (p.entries.size === 0) {
        releasePool();
      }
    };
  }, [props.build, size]);

  return <canvas ref={canvasRef} class={props.class} />;
}
