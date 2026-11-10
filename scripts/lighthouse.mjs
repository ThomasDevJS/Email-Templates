// `npm run lighthouse`: builds the web app with the dev harness, serves it on 127.0.0.1 and runs the Lighthouse
// accessibility audit on the library, editor, history, the 6 admin tabs and trash views (spec section 8, target 90 or higher).
// Chrome: CHROME_PATH, else the preinstalled /opt/pw-browsers/chromium. No browser is downloaded.
import { launch } from "chrome-launcher";
import { existsSync } from "node:fs";
import lighthouse from "lighthouse";
import { localPage } from "./lib/html.mjs";
import { fail } from "./tools.mjs";
import { DEV_PAGE_VALUES, servePage, webPage } from "./web.mjs";

const MIN_SCORE = 90;
const DEFAULT_CHROME = "/opt/pw-browsers/chromium";
const VIEWS = [
  ["library", "?latency=0#/library"],
  ["editor", "?latency=0#/edit/T-QUOTE"],
  ["history", "?latency=0#/history/T-QUOTE"],
  ["admin", "?latency=0#/admin"],
  ["admin memberships", "?latency=0#/admin/memberships"],
  ["admin audit", "?latency=0#/admin/audit"],
  ["admin usage", "?latency=0#/admin/usage"],
  ["admin export and import", "?latency=0#/admin/transfer"],
  ["admin config", "?latency=0#/admin/config"],
  ["trash", "?latency=0#/trash"],
];

function chromePath() {
  const path = process.env.CHROME_PATH ?? DEFAULT_CHROME;
  if (!existsSync(path)) fail(`No Chrome at ${path}. Set CHROME_PATH.`);
  return path;
}

async function audit(url, port) {
  const result = await lighthouse(url, {
    port,
    onlyCategories: ["accessibility"],
    output: "json",
    logLevel: "error",
  });
  const category = result?.lhr.categories["accessibility"];
  const failing = Object.values(result?.lhr.audits ?? {})
    .filter((entry) => entry.score === 0 && entry.scoreDisplayMode === "binary")
    .map((entry) => entry.id);
  return { score: Math.round((category?.score ?? 0) * 100), failing };
}

async function main() {
  const html = localPage(await webPage({ harness: true }), DEV_PAGE_VALUES);
  const server = await servePage(html, 0);
  const chrome = await launch({
    chromePath: chromePath(),
    chromeFlags: ["--headless=new", "--no-sandbox", "--disable-gpu"],
  });
  const low = [];
  try {
    for (const [name, path] of VIEWS) {
      const { score, failing } = await audit(
        `${server.url}${path}`,
        chrome.port,
      );
      const note =
        failing.length === 0 ? "" : ` (failing: ${failing.join(", ")})`;
      console.log(`Lighthouse accessibility ${name}: ${String(score)}${note}`);
      if (score < MIN_SCORE) low.push(`${name} ${String(score)}`);
    }
  } finally {
    await chrome.kill();
    await server.close();
  }
  if (low.length > 0) fail(`Under ${String(MIN_SCORE)}: ${low.join(", ")}`);
}

main().catch((error) =>
  fail(error instanceof Error ? error.message : String(error)),
);
