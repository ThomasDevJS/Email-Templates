// deploy/<env>.json reader (ADR-0005 Environments). Holds IDs and URLs only, never credentials.

export const ENVIRONMENTS = Object.freeze(["dev", "prod"]);
export const MODES = Object.freeze(["head", "version"]);
const EXEC_URL_PREFIX = "https://script.google.com/macros/s/";

/**
 * @typedef {{ scriptId: string, deploymentId: string, execUrl: string, mode: "head" | "version" }} DeployConfig
 */

/**
 * @param {unknown} env
 * @returns {"dev" | "prod"}
 */
export function parseEnv(env) {
  if (env === "dev" || env === "prod") return env;
  throw new Error(
    `Environment must be one of ${ENVIRONMENTS.join(", ")}; got "${String(env)}".`,
  );
}

/**
 * @param {Record<string, unknown>} raw
 * @param {string} key
 * @returns {string}
 */
function stringField(raw, key) {
  const value = raw[key];
  if (typeof value !== "string")
    throw new Error(`deploy config field "${key}" must be a string.`);
  return value;
}

/**
 * Validates the shape. Empty IDs are allowed so CI can build; `requireDeployable` checks them before a deploy.
 * @param {unknown} raw parsed deploy/<env>.json
 * @returns {DeployConfig}
 */
export function parseDeployConfig(raw) {
  if (typeof raw !== "object" || raw === null)
    throw new Error("deploy config must be a JSON object.");
  const record = /** @type {Record<string, unknown>} */ (raw);
  const mode = record.mode;
  if (mode !== "head" && mode !== "version")
    throw new Error(`deploy config "mode" must be one of ${MODES.join(", ")}.`);
  const execUrl = stringField(record, "execUrl");
  if (execUrl !== "" && !execUrl.startsWith(EXEC_URL_PREFIX)) {
    throw new Error(
      `deploy config "execUrl" must start with ${EXEC_URL_PREFIX}.`,
    );
  }
  return {
    scriptId: stringField(record, "scriptId"),
    deploymentId: stringField(record, "deploymentId"),
    execUrl,
    mode,
  };
}

/**
 * @param {DeployConfig} config
 * @returns {string[]} missing fields that block a deploy in this mode
 */
export function missingForDeploy(config) {
  const missing = [];
  if (config.scriptId === "") missing.push("scriptId");
  if (config.mode === "version" && config.deploymentId === "")
    missing.push("deploymentId");
  return missing;
}
