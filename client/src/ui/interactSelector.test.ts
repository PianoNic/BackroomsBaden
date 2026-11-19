import { describe, expect, it } from "vitest";
import type { InteractTarget } from "./interactPrompt";
import { InteractSelector } from "./interactSelector";

const POSE = { x: 0, z: 0, forwardX: 0, forwardZ: -1 };

function target(kind: InteractTarget["kind"], x: number, z: number, radius = 2): InteractTarget {
  return { x, z, radius, label: kind, kind };
}

describe("InteractSelector", () => {
  it("picks the task spot over a locker that is slightly better aimed", () => {
    const locker = target("locker", 0, -1.2);
    const quest = target("quest", 0.6, -1.0);

    expect(InteractSelector.pick([locker, quest], POSE)?.kind).toBe("quest");
  });

  it("still picks the locker when no task is in reach", () => {
    const locker = target("locker", 0, -1.2);
    const farQuest = target("quest", 0, -9);

    expect(InteractSelector.pick([locker, farQuest], POSE)?.kind).toBe("locker");
  });

  it("ignores targets behind the player", () => {
    expect(InteractSelector.pick([target("quest", 0, 1)], POSE)).toBeNull();
  });

  it("prefers the better aimed of two targets of the same kind", () => {
    const left = target("locker", -1.0, -1.0);
    const ahead = target("locker", 0, -1.0);

    expect(InteractSelector.pick([left, ahead], POSE)).toBe(ahead);
  });
});
