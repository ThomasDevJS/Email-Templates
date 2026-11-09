// `npm run setup:check`: reports clasp login state and deploy config, then prints the next step from
// docs/ops/deploy.md. Prints yes/no only; never prints tokens, client IDs or account details.
import { ENVIRONMENTS, parseDeployConfig } from "./lib/deployConfig.mjs";
import { claspJson, deployConfigPath, hasClasp, readJson } from "./tools.mjs";

const REQUIRED_NODE_MAJOR = 22;

function isLoggedIn() {
  try {
    return JSON.parse(claspJson(["show-authorized-user"])).loggedIn === true;
  } catch {
    return false;
  }
}

function configStatus(env) {
  try {
    const config = parseDeployConfig(readJson(deployConfigPath(env)));
    return {
      config,
      line: `deploy/${env}.json: mode ${config.mode}, scriptId ${mark(config.scriptId)}, deploymentId ${mark(config.deploymentId)}, execUrl ${mark(config.execUrl)}`,
    };
  } catch (error) {
    return {
      config: null,
      line: `deploy/${env}.json: invalid (${error instanceof Error ? error.message : String(error)})`,
    };
  }
}

function mark(value) {
  return value === "" ? "missing" : "set";
}

function nextStep(nodeOk, loggedIn, dev) {
  if (!nodeOk)
    return `Install Node ${String(REQUIRED_NODE_MAJOR)} (see .nvmrc).`;
  if (!hasClasp()) return "Run npm ci.";
  if (!loggedIn) return "Run npx clasp login.";
  if (dev === null) return "Fix deploy/dev.json.";
  if (dev.scriptId === "") {
    return 'Run npx clasp create --type standalone --title "Migway Templates (dev)" --rootDir dist, copy the scriptId into deploy/dev.json, delete the generated .clasp.json.';
  }
  if (dev.execUrl === "") {
    return "Run npm run deploy -- dev, then create the web app deployment in the editor and copy deploymentId and execUrl into deploy/dev.json (docs/ops/deploy.md step 6).";
  }
  return "Run npm run deploy -- dev.";
}

const nodeMajor = Number(process.versions.node.split(".")[0]);
const nodeOk = nodeMajor === REQUIRED_NODE_MAJOR;
const loggedIn = hasClasp() && isLoggedIn();
const statuses = Object.fromEntries(
  ENVIRONMENTS.map((env) => [env, configStatus(env)]),
);

console.log(
  `Node ${process.versions.node}: ${nodeOk ? "ok" : `need ${String(REQUIRED_NODE_MAJOR)}`}`,
);
console.log(`clasp installed: ${hasClasp() ? "yes" : "no"}`);
console.log(`clasp logged in: ${loggedIn ? "yes" : "no"}`);
for (const env of ENVIRONMENTS) console.log(statuses[env].line);
console.log(`Next step: ${nextStep(nodeOk, loggedIn, statuses.dev.config)}`);
