// `npm run dev:web [-- --port 5173]`: the web app with the dev harness (fake google.script, in-memory data) on
// http://127.0.0.1:<port>/. Local only; nothing is deployed and no Google API is called.
import { parseArgs } from "node:util";
import { localPage } from "./lib/html.mjs";
import { fail } from "./tools.mjs";
import { DEV_PAGE_VALUES, servePage, webPage } from "./web.mjs";

async function main() {
  const { values } = parseArgs({
    options: { port: { type: "string", default: "5173" } },
  });
  const html = localPage(await webPage({ harness: true }), DEV_PAGE_VALUES);
  const { url } = await servePage(html, Number(values.port));
  console.log(`Web app with dev harness: ${url}`);
  console.log(
    "Routes: #/library, #/edit/T-QUOTE, #/history/T-QUOTE, #/new?folder=F-QUOTES",
  );
  console.log(
    "Failures: ?fail=BUSY&failOp=template.update (any error code and op). Ctrl+C stops.",
  );
}

main().catch((error) =>
  fail(error instanceof Error ? error.message : String(error)),
);
