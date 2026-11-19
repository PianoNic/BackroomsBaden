export class EyeHeight {
  static readonly STANDING = 1.7;
  static readonly CROUCHING = 1.0;
  static readonly RATE = 12;

  private current: number = EyeHeight.STANDING;

  get value(): number {
    return this.current;
  }

  reset(): void {
    this.current = EyeHeight.STANDING;
  }

  step(crouching: boolean, dt: number): number {
    const target = crouching ? EyeHeight.CROUCHING : EyeHeight.STANDING;
    this.current += (target - this.current) * Math.min(1, dt * EyeHeight.RATE);
    return this.current;
  }
}
