// `npm run rollback -- <env> [version]` (ADR-0005). Re-points the deployment at an earlier version.
// The deployment keeps its ID and /exec URL. Default target: the version before the one it serves now.
import { deploymentVersion } from "./lib/claspOutput.mjs";
import { missingForDeploy, parseEnv } from "./lib/deployConfig.mjs";
import {
  clasp,
  claspJson,
  fail,
  loadDeployConfig,
  tempProject,
} from "./tools.mjs";

function parseTarget(arg, current) {
  if (arg === undefined) {
    if (current === undefined || current < 2)
      fail("No earlier version to roll back to. Pass a version number.");
    return current - 1;
  }
  const version = Number(arg);
  if (!Number.isInteger(version) || version < 1)
    fail(`Version must be a positive integer; got "${arg}".`);
  if (version === current)
    fail(`The deployment already serves version ${String(version)}.`);
  return version;
}

function main() {
  const env = parseEnv(process.argv[2]);
  const config = loadDeployConfig(env);
  if (config.mode === "head") {
    fail(
      "Mode head has no versions. Check out the previous commit and run npm run deploy -- " +
        env +
        ".",
    );
  }
  const missing = missingForDeploy(config);
  if (missing.length > 0)
    fail(`deploy/${env}.json is missing ${missing.join(", ")}.`);
  const project = tempProject(config.scriptId);
  const current = deploymentVersion(
    claspJson(["-P", project, "list-deployments"]),
    config.deploymentId,
  );
  const target = parseTarget(process.argv[3], current);
  clasp([
    "-P",
    project,
    "create-deployment",
    "-i",
    config.deploymentId,
    "-V",
    String(target),
    "-d",
    `rollback to v${String(target)}`,
  ]);
  console.log(
    `Deployment ${env} now serves version ${String(target)} (was ${String(current)}).`,
  );
}

try {
  main();
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}
