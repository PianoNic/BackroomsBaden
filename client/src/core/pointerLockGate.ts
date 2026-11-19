export class PointerLockGate {
  private static pendingGameReleases = 0;

  static releaseForGame(): void {
    if (!document.pointerLockElement) return;
    PointerLockGate.pendingGameReleases += 1;
    document.exitPointerLock();
  }

  static consumeGameRelease(): boolean {
    if (PointerLockGate.pendingGameReleases === 0) return false;
    PointerLockGate.pendingGameReleases -= 1;
    return true;
  }

  static reset(): void {
    PointerLockGate.pendingGameReleases = 0;
  }
}
