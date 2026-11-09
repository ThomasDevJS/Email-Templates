/**
 * In-memory LockService. One lock per scope. `holdElsewhere()` simulates another execution holding it,
 * so `tryLock` returns false and `waitLock` throws the platform's timeout error.
 */
export class FakeLock {
  private heldHere = false;
  private heldElsewhere = false;
  /** Times `tryLock` was called while this execution already held the lock. Server code never nests. */
  nestedAcquisitions = 0;

  holdElsewhere(held = true): void {
    this.heldElsewhere = held;
  }

  tryLock(timeoutMs: number): boolean {
    if (timeoutMs < 0) throw new Error("Invalid timeout");
    if (this.heldElsewhere) return false;
    if (this.heldHere) this.nestedAcquisitions++;
    this.heldHere = true;
    return true;
  }

  waitLock(timeoutMs: number): void {
    if (!this.tryLock(timeoutMs)) {
      throw new Error(
        `Lock timeout: another process was holding the lock for too long (${String(timeoutMs)} ms).`,
      );
    }
  }

  hasLock(): boolean {
    return this.heldHere;
  }

  releaseLock(): void {
    this.heldHere = false;
  }
}

export interface FakeLockService {
  readonly script: FakeLock;
  readonly user: FakeLock;
  getScriptLock(): FakeLock;
  getUserLock(): FakeLock;
  getDocumentLock(): null;
}

export function createLockService(): FakeLockService {
  const script = new FakeLock();
  const user = new FakeLock();
  return {
    script,
    user,
    getScriptLock: () => script,
    getUserLock: () => user,
    getDocumentLock: () => null,
  };
}
