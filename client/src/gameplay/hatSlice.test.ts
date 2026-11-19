import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { Scene } from "@babylonjs/core/scene";
import { box, setActiveScene } from "../rendering/babylon";
import { HatSlice } from "./hatSlice";
import { buildHat } from "./remotePlayerMaterials";

describe("HatSlice", () => {
  let engine: NullEngine;
  let scene: Scene;

  beforeAll(() => {
    engine = new NullEngine();
    scene = new Scene(engine);
    setActiveScene(scene);
  });

  afterAll(() => {
    scene.dispose();
    engine.dispose();
  });

  const wearer = () => {
    const body = box(0.6, 1.7, 0.6);
    body.position.set(2, 0.85, -1);
    const hat = buildHat("wizard")!;
    hat.parent = body;
    return body;
  };

  it("measures the tapering cone at the requested height", () => {
    const body = wearer();
    const tip = 0.85 + 1.595;
    for (const y of [1.9, 2.1, 2.3]) {
      const expected = (0.24 * (tip - y)) / 0.65;
      expect(HatSlice.maxRadius(body, y)).toBeCloseTo(expected, 1);
    }
  });

  it("is zero above the tip and reaches the brim lower down", () => {
    const body = wearer();
    expect(HatSlice.maxRadius(body, 0.85 + 1.7)).toBe(0);
    expect(HatSlice.maxRadius(body, 0.85 + 0.9)).toBeGreaterThan(0.3);
  });
});
