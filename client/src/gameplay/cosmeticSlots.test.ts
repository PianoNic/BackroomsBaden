import { describe, it, expect } from "vitest";
import type { CatalogItem, EquippedCosmetics } from "../net/protocol";
import { CosmeticSlots } from "./cosmeticSlots";

function item(id: string, category: CatalogItem["category"], assetRef: string, attach?: CatalogItem["attach"]): CatalogItem {
  return { id, category, name: id, price: 0, rarity: "common", assetRef, default: false, attach };
}

const CATALOG = new Map<string, CatalogItem>([
  ["hat_grad", item("hat_grad", "hat", "gradcap")],
  ["hat_fischer", item("hat_fischer", "hat", "models/cosmetics/hat_fischer", { x: 0, y: 0.8, z: 0, scale: 0.25, yaw: 0, pitch: 0 })],
  ["backpack_none", item("backpack_none", "backpack", "")],
  ["backpack_schul", item("backpack_schul", "backpack", "models/cosmetics/backpack_rucksack")],
  ["mask_gas", item("mask_gas", "mask", "models/pickups/goggles")],
  ["handitem_stuhl", item("handitem_stuhl", "handitem", "")],
  ["handitem_lupe", item("handitem_lupe", "handitem", "models/cosmetics/handitem_lupe")],
]);

const resolve = (id: string | undefined) => (id ? CATALOG.get(id) : undefined);

describe("CosmeticSlots.slotFor", () => {
  it("maps hat, backpack and mask to head, back and face", () => {
    expect(CosmeticSlots.slotFor("hat")).toBe("head");
    expect(CosmeticSlots.slotFor("backpack")).toBe("back");
    expect(CosmeticSlots.slotFor("mask")).toBe("face");
  });

  it("returns null for categories that have no body slot", () => {
    expect(CosmeticSlots.slotFor("body")).toBeNull();
    expect(CosmeticSlots.slotFor("handitem")).toBeNull();
    expect(CosmeticSlots.slotFor("title")).toBeNull();
  });
});

describe("CosmeticSlots.resolveSource", () => {
  it("treats a models/ ref as a glTF url", () => {
    expect(CosmeticSlots.resolveSource("models/cosmetics/hat_fischer")).toEqual({
      kind: "model", ref: "models/cosmetics/hat_fischer", url: "/models/cosmetics/hat_fischer.glb",
    });
  });

  it("treats any other ref as a procedural key", () => {
    expect(CosmeticSlots.resolveSource("gradcap")).toEqual({ kind: "procedural", key: "gradcap" });
  });

  it("returns null for an empty or missing ref", () => {
    expect(CosmeticSlots.resolveSource("")).toBeNull();
    expect(CosmeticSlots.resolveSource(undefined)).toBeNull();
  });
});

describe("CosmeticSlots.pose", () => {
  it("passes the authored attach values through", () => {
    expect(CosmeticSlots.pose({ x: 0.1, y: 0.2, z: 0.3, scale: 0.5, yaw: 1, pitch: 2 })).toEqual({
      x: 0.1, y: 0.2, z: 0.3, scale: 0.5, yaw: 1, pitch: 2,
    });
  });

  it("falls back to the identity pose without an attach", () => {
    expect(CosmeticSlots.pose(null)).toEqual(CosmeticSlots.IDENTITY);
    expect(CosmeticSlots.pose(undefined)).toEqual(CosmeticSlots.IDENTITY);
  });

  it("replaces a non-positive scale with 1", () => {
    expect(CosmeticSlots.pose({ x: 0, y: 0, z: 0, scale: 0, yaw: 0, pitch: 0 }).scale).toBe(1);
  });
});

describe("CosmeticSlots.entries", () => {
  it("lists one entry per equipped slot and skips empty refs", () => {
    const equipped: EquippedCosmetics = {
      hat: "hat_fischer", backpack: "backpack_none", mask: "mask_gas",
    };
    const slots = CosmeticSlots.entries(equipped, resolve).map((e) => e.slot);
    expect(slots).toEqual(["head", "face"]);
  });

  it("mixes procedural and model sources", () => {
    const entries = CosmeticSlots.entries({ hat: "hat_grad", backpack: "backpack_schul" }, resolve);
    expect(entries.map((e) => e.source.kind)).toEqual(["procedural", "model"]);
  });

  it("ignores unknown ids", () => {
    expect(CosmeticSlots.entries({ hat: "nope" }, resolve)).toEqual([]);
  });
});

describe("CosmeticSlots.heldModel", () => {
  it("returns the model for a model hand item", () => {
    expect(CosmeticSlots.heldModel({ handitem: "handitem_lupe" }, resolve)?.url).toBe(
      "/models/cosmetics/handitem_lupe.glb",
    );
  });

  it("returns null for the default chair or nothing equipped", () => {
    expect(CosmeticSlots.heldModel({ handitem: "handitem_stuhl" }, resolve)).toBeNull();
    expect(CosmeticSlots.heldModel({}, resolve)).toBeNull();
  });
});
