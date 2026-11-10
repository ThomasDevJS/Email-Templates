import { h } from "./dom";

/**
 * People as the design system shows them: the name part of an address and an avatar with initials, never a photo.
 * Parts of the local part split at ".", "_", "-" and "+".
 */
function parts(email: string): string[] {
  const local = email.split("@")[0] ?? "";
  return local.split(/[._+-]/).filter((part) => part !== "");
}

const capital = (word: string) => word.charAt(0).toUpperCase() + word.slice(1);

/** "ben.kowalski@example.com" gives "Ben K.", "ben@example.com" gives "Ben", "" gives "". */
export function shortName(email: string): string {
  const [first, second] = parts(email);
  if (first === undefined) return "";
  return second === undefined
    ? capital(first)
    : `${capital(first)} ${second.charAt(0).toUpperCase()}.`;
}

/** First letters of the first two parts of the local part: "BK", "B", or "" for a blank address. */
export function initials(email: string): string {
  return parts(email)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

/**
 * Avatar and name part. The full address is the tooltip and screen-reader text, or with `showAddress` a visible
 * second line (the audit log, where keyboard and touch users need it and two people can share a name part).
 */
export function person(email: string, showAddress = false): HTMLElement {
  const address =
    email === ""
      ? null
      : showAddress
        ? h("span", { class: "who-address" }, email)
        : h("span", { class: "sr-only" }, ` (${email})`);
  return h(
    "span",
    {
      class: showAddress ? "who stacked" : "who",
      title: showAddress ? null : email,
    },
    h("span", { class: "avatar", "aria-hidden": "true" }, initials(email)),
    h("span", { class: "who-text" }, shortName(email), address),
  );
}
