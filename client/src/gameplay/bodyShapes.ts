import type { BodyShape } from "./bodyShape";
import { BoxBodyShape } from "./boxBodyShape";
import { HumanBodyShape } from "./humanBodyShape";
import { humanBodyModels } from "./humanBodyModels";

export class BodyShapes {
  private static readonly box = new BoxBodyShape();
  private static readonly human = new HumanBodyShape();

  static load(): Promise<boolean> {
    return humanBodyModels.load();
  }

  static current(): BodyShape {
    return humanBodyModels.ready() ? BodyShapes.human : BodyShapes.box;
  }
}
