/**
 * Guard for add-on callbacks (ENTRY_POINTS surface `addon`). In Gmail the add-on runs as the user, so the active
 * and effective users are the same account. Through `google.script.run` in the web app the callback would run as
 * the owner (effective) for another caller (active) and fetch the server with the owner's token; it refuses then.
 */
export function requireAddonSession(name: string): void {
  const active = Session.getActiveUser().getEmail().trim().toLowerCase();
  const effective = Session.getEffectiveUser().getEmail().trim().toLowerCase();
  if (active === "" || active !== effective) {
    throw new Error(`${name} runs only inside the Gmail add-on`);
  }
}
