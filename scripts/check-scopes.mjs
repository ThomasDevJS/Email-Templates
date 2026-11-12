// `npm run scopes:check`: fails when appsscript.json names a scope outside docs/spec.md section 9.
import { join } from "node:path";
import { checkScopes } from "./lib/scopes.mjs";
import { ROOT, fail, readJson } from "./tools.mjs";

const manifest = readJson(join(ROOT, "appsscript.json"));
const errors = checkScopes(
  manifest,
  readJson(join(ROOT, "scripts", "approved-scopes.json")),
);
if (errors.length > 0) fail(`Scope check failed:\n  ${errors.join("\n  ")}`);
console.log(
  `Scope check passed: ${String(manifest.oauthScopes.length)} scopes, all approved.`,
);
