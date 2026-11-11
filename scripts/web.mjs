// Web app page builder and local server, shared by build.mjs, dev-web.mjs and lighthouse.mjs.
import { build, transform } from "esbuild";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { inlineHtml } from "./lib/html.mjs";

// Not imported from tools.mjs, so unit tests can load this file without the deploy helpers.
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const WEB_DIR = join(ROOT, "src", "web");
/** ProseMirror's required editor rules first, then the app styles. */
const WEB_STYLES = [
  join(ROOT, "node_modules", "prosemirror-view", "style", "prosemirror.css"),
  join(WEB_DIR, "styles.css"),
];

/** Scriptlet values for local pages (dev harness, Lighthouse). */
export const DEV_PAGE_VALUES = Object.freeze({
  email: "dev.user@example.com",
  appVersion: "dev",
});

/**
 * index.html with the bundle and styles inlined (ADR-0005, no CDN). With `harness`, the dev harness runs first
 * and fakes `google.script`; production builds never include it.
 * @param {{ harness: boolean }} options
 * @returns {Promise<string>}
 */
export async function webPage({ harness }) {
  const contents = harness
    ? 'import "./dev-harness"; import "./app";'
    : 'import "./app";';
  const result = await build({
    stdin: {
      contents,
      resolveDir: WEB_DIR,
      loader: "ts",
      sourcefile: "web-entry.ts",
    },
    bundle: true,
    format: "iife",
    target: "es2020",
    minify: true,
    write: false,
    logLevel: "warning",
    charset: "utf8",
  });
  const template = readFileSync(join(WEB_DIR, "index.html"), "utf8");
  const styles = await minifiedStyles(
    WEB_STYLES.map((path) => readFileSync(path, "utf8")).join("\n"),
  );
  return inlineHtml(template, {
    script: (result.outputFiles[0]?.text ?? "").trim(),
    styles,
  });
}

/**
 * The stylesheet minified (comments dropped, about 11 KB less). Like the script, it may hold no `//`, `/*`, `<?`
 * (an HtmlService scriptlet) or `</style`.
 * @param {string} css
 * @returns {Promise<string>}
 */
export async function minifiedStyles(css) {
  const { code } = await transform(css, {
    loader: "css",
    minify: true,
    legalComments: "none",
    charset: "utf8",
  });
  const found = ["//", "/*", "<?", "</style"].filter((part) =>
    code.toLowerCase().includes(part),
  );
  if (found.length > 0)
    throw new Error(`Minified styles contain ${found.join(", ")}.`);
  return code.trim();
}

/**
 * Serves one page at every path on 127.0.0.1.
 * @param {string} html
 * @param {number} port 0 picks a free port
 * @returns {Promise<{ url: string, close: () => Promise<void> }>}
 */
export function servePage(html, port) {
  const server = createServer((_request, response) => {
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end(html);
  });
  return new Promise((resolve) => {
    server.listen(port, "127.0.0.1", () => {
      const address = server.address();
      const actual =
        typeof address === "object" && address !== null ? address.port : port;
      resolve({
        url: `http://127.0.0.1:${String(actual)}/`,
        close: () => new Promise((done) => server.close(() => done())),
      });
    });
  });
}
