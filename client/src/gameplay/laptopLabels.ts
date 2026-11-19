import type { LaptopGame } from "../net/protocol";

export class LaptopLabels {
  private static readonly LABELS: Record<LaptopGame, string> = {
    slots: "play slot machine",
    dice: "roll dice",
    coinflip: "flip a coin",
    teams_call: "answer Teams call",
    teams_dm: "reply on Teams",
    teams_file: "open Teams files",
    moodle_course: "open Moodle",
    moodle_file: "open Moodle files",
    moodle_quiz: "take Moodle quiz",
    rpg_battle: "start Schul-Quest",
  };

  static for(game: LaptopGame): string {
    return LaptopLabels.LABELS[game];
  }
}
