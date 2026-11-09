// Parsers for `clasp --json` output (clasp 3.4.1: create-version, list-versions, list-deployments).

export const VERSION_LIMIT = 200;
export const PRUNE_AT = 150;

/**
 * @param {string} stdout output of `clasp --json create-version`
 * @returns {number}
 */
export function parseCreatedVersion(stdout) {
  const parsed = /** @type {unknown} */ (JSON.parse(stdout));
  const versionNumber = isRecord(parsed) ? parsed.versionNumber : undefined;
  if (typeof versionNumber !== "number")
    throw new Error("clasp create-version returned no versionNumber.");
  return versionNumber;
}

/**
 * @param {string} stdout output of `clasp --json list-versions`
 * @returns {number}
 */
export function countVersions(stdout) {
  return parseArray(stdout, "list-versions").length;
}

/**
 * @param {string} stdout output of `clasp --json list-deployments`
 * @param {string} deploymentId
 * @returns {number | undefined} version the deployment serves; undefined for HEAD or an unknown ID
 */
export function deploymentVersion(stdout, deploymentId) {
  const match = parseArray(stdout, "list-deployments").find(
    (entry) => isRecord(entry) && entry.deploymentId === deploymentId,
  );
  const versionNumber = isRecord(match) ? match.versionNumber : undefined;
  return typeof versionNumber === "number" ? versionNumber : undefined;
}

/**
 * @param {number} used
 * @returns {string}
 */
export function versionUsageLine(used) {
  const advice =
    used >= PRUNE_AT
      ? " Prune old versions in Project History now (docs/ops/deploy.md)."
      : "";
  return `Versions used ${String(used)} of ${String(VERSION_LIMIT)}; prune at ${String(PRUNE_AT)}.${advice}`;
}

/**
 * @param {string} stdout
 * @param {string} command
 * @returns {unknown[]}
 */
function parseArray(stdout, command) {
  const parsed = /** @type {unknown} */ (JSON.parse(stdout));
  if (!Array.isArray(parsed))
    throw new Error(`clasp ${command} did not return a JSON array.`);
  return parsed;
}

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isRecord(value) {
  return typeof value === "object" && value !== null;
}
