import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { InstancedMesh } from "@babylonjs/core/Meshes/instancedMesh";
import { VertexBuffer } from "@babylonjs/core/Buffers/buffer";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";

export class HatSlice {
  static maxRadius(owner: AbstractMesh, atY: number): number {
    const center = owner.getAbsolutePosition();
    let radius = 0;
    const point = new Vector3();
    for (const mesh of owner.getChildMeshes(false)) {
      if (!mesh.isEnabled(false)) continue;
      const source = mesh instanceof InstancedMesh ? mesh.sourceMesh : mesh;
      const positions = source.getVerticesData(VertexBuffer.PositionKind);
      const indices = source.getIndices();
      if (!positions || !indices) continue;
      const world = mesh.computeWorldMatrix(true);
      const count = positions.length / 3;
      const xs = new Float32Array(count);
      const ys = new Float32Array(count);
      const zs = new Float32Array(count);
      for (let i = 0; i < count; i++) {
        Vector3.TransformCoordinatesFromFloatsToRef(
          positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2], world, point,
        );
        xs[i] = point.x - center.x;
        ys[i] = point.y;
        zs[i] = point.z - center.z;
        if (ys[i] >= atY) radius = Math.max(radius, Math.hypot(xs[i], zs[i]));
      }
      for (let t = 0; t < indices.length; t += 3) {
        for (let e = 0; e < 3; e++) {
          const a = indices[t + e];
          const b = indices[t + ((e + 1) % 3)];
          const low = ys[a] < ys[b] ? a : b;
          const high = low === a ? b : a;
          if (ys[low] >= atY || ys[high] < atY) continue;
          const k = (atY - ys[low]) / (ys[high] - ys[low]);
          const x = xs[low] + (xs[high] - xs[low]) * k;
          const z = zs[low] + (zs[high] - zs[low]) * k;
          radius = Math.max(radius, Math.hypot(x, z));
        }
      }
    }
    return radius;
  }
}
