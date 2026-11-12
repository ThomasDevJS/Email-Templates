/** In-memory Session. `activeEmail` is blank when Google cannot identify the caller (ADR-0003 Part A). */
export interface FakeSession {
  activeEmail: string;
  effectiveEmail: string;
  getActiveUser(): { getEmail(): string };
  getEffectiveUser(): { getEmail(): string };
  getTemporaryActiveUserKey(): string;
}

export function createSession(
  activeEmail: string,
  effectiveEmail = "owner@example.com",
): FakeSession {
  const session: FakeSession = {
    activeEmail,
    effectiveEmail,
    getActiveUser: () => ({ getEmail: () => session.activeEmail }),
    getEffectiveUser: () => ({ getEmail: () => session.effectiveEmail }),
    getTemporaryActiveUserKey: () =>
      session.activeEmail === "" ? "" : `key-${session.activeEmail}`,
  };
  return session;
}
