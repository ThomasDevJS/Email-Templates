/** Static pages served by `doGet` without the app shell (wireframe 07, state D). */

export const CANNOT_IDENTIFY_TITLE = "Cannot identify your Migway account";

/** Text of the AUTH_NO_USER state, shared by the web app page and, from slice 4, the sidebar. */
export const CANNOT_IDENTIFY_LINES: readonly string[] = [
  "Cannot identify your Migway account.",
  "This app does not work when several Google accounts are signed in.",
  "Use a separate Chrome profile for Migway, or an incognito window with only your Migway account.",
];

export function cannotIdentifyPageHtml(): string {
  const paragraphs = CANNOT_IDENTIFY_LINES.map((line) => `<p>${line}</p>`).join(
    "\n    ",
  );
  return [
    "<!doctype html>",
    '<html lang="en">',
    "  <body>",
    `    <main role="alert">\n    ${paragraphs}\n    </main>`,
    "  </body>",
    "</html>",
  ].join("\n");
}
