import { describe, expect, it } from "vitest";
import type { LaptopGame } from "../net/protocol";
import { LaptopLabels } from "./laptopLabels";

const GAMES: LaptopGame[] = [
  "slots", "dice", "coinflip",
  "teams_call", "teams_dm", "teams_file",
  "moodle_course", "moodle_file", "moodle_quiz",
  "rpg_battle",
];

describe("LaptopLabels", () => {
  it.each(GAMES)("has a readable label for %s", (game) => {
    const label = LaptopLabels.for(game);
    expect(label.length).toBeGreaterThan(3);
    expect(label).not.toContain("_");
    expect(label).not.toBe(game);
  });
});
