// `npm run deploy -- <env>` on the owner's machine (ADR-0005 Environments and deployment).
// Steps: clean tree check, build, drift check, clasp push, then in mode "version": create a version and
// point the deployment at it. Reads deploy/<env>.json only; clasp uses the owner's own login.
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PUSHED_FILES, driftedFiles, normalizeForDrift } from "./lib/drift.mjs";
import { missingForDeploy, parseEnv } from "./lib/deployConfig.mjs";
import {
  countVersions,
  parseCreatedVersion,
  versionUsageLine,
} from "./lib/claspOutput.mjs";
import {
  DIST,
  ROOT,
  clasp,
  claspJson,
  fail,
  gitBranch,
  gitIsDirty,
  gitShortSha,
  loadDeployConfig,
  readJson,
  run,
  tempProject,
  writeJson,
} from "./tools.mjs";

function lastPushPath(env) {
  return join(ROOT, "deploy", `.last-push-${env}.json`);
}

function hashFiles(dir) {
  const hashes = {};
  for (const name of PUSHED_FILES) {
    const path = join(dir, name);
    if (!existsSync(path)) continue;
    const normalized = normalizeForDrift(name, readFileSync(path, "utf8"));
    hashes[name] = createHash("sha256").update(normalized).digest("hex");
  }
  return hashes;
}

function checkPreconditions(env, config) {
  const missing = missingForDeploy(config);
  if (missing.length > 0)
    fail(
      `deploy/${env}.json is missing ${missing.join(", ")}. See docs/ops/deploy.md.`,
    );
  if (gitIsDirty())
    fail("Working tree has uncommitted changes. Commit or discard them first.");
  if (env === "prod" && gitBranch() !== "main")
    fail("Prod deploys run from main only.");
}

/** Aborts when the remote code differs from the last push from this machine (browser edit). */
function checkDrift(env, config) {
  const recordPath = lastPushPath(env);
  if (!existsSync(recordPath)) {
    console.log(
      "Drift check skipped: no earlier push recorded on this machine.",
    );
    return;
  }
  const pulled = tempProject(config.scriptId);
  clasp(["-P", pulled, "pull"]);
  const drifted = driftedFiles(readJson(recordPath), hashFiles(pulled));
  if (drifted.length > 0) {
    fail(
      `Remote project changed since the last push (${drifted.join(", ")}). Someone edited it in the browser. Inspect ${pulled}, then delete ${recordPath} to accept the overwrite.`,
    );
  }
  console.log("Drift check passed.");
}

function publishVersion(config, sha) {
  const project = tempProject(config.scriptId);
  const version = parseCreatedVersion(
    claspJson(["-P", project, "create-version", sha]),
  );
  clasp([
    "-P",
    project,
    "create-deployment",
    "-i",
    config.deploymentId,
    "-V",
    String(version),
    "-d",
    sha,
  ]);
  console.log(`Deployment now serves version ${String(version)} (${sha}).`);
  console.log(
    versionUsageLine(
      countVersions(claspJson(["-P", project, "list-versions"])),
    ),
  );
}

function main() {
  const env = parseEnv(process.argv[2]);
  const config = loadDeployConfig(env);
  checkPreconditions(env, config);
  const sha = gitShortSha();
  run(process.execPath, [join(ROOT, "scripts", "build.mjs"), "--env", env]);
  checkDrift(env, config);
  clasp(["-P", DIST, "push", "--force"]);
  writeJson(lastPushPath(env), hashFiles(DIST));
  if (config.mode === "head") {
    console.log(
      "Mode head: pushed to HEAD. Test deployments and the /dev URL serve it now. No version created.",
    );
    return;
  }
  publishVersion(config, sha);
}

try {
  main();
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}
