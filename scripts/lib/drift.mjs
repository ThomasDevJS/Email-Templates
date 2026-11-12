// Drift check (ADR-0005 deploy step 3): the remote project must match the build recorded at the last push.
// A difference means someone edited code in the browser editor; the deploy aborts instead of overwriting it.

export const PUSHED_FILES = Object.freeze([
  "Code.js",
  "index.html",
  "appsscript.json",
]);

/**
 * @param {unknown} value
 * @returns {unknown}
 */
function sortKeys(value) {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (typeof value !== "object" || value === null) return value;
  const record = /** @type {Record<string, unknown>} */ (value);
  return Object.fromEntries(
    Object.keys(record)
      .sort()
      .map((key) => [key, sortKeys(record[key])]),
  );
}

/**
 * The manifest is compared as canonical JSON because Apps Script may reformat it.
 * Other files are compared with normalized line endings and no trailing whitespace at the end.
 * @param {string} name
 * @param {string} content
 * @returns {string}
 */
export function normalizeForDrift(name, content) {
  if (name === "appsscript.json")
    return JSON.stringify(sortKeys(JSON.parse(content)));
  return content.replace(/\r\n/g, "\n").trimEnd();
}

/**
 * @param {Readonly<Record<string, string>>} recorded hash per file at the last push
 * @param {Readonly<Record<string, string | undefined>>} remote hash per file pulled now; undefined when missing
 * @returns {string[]} names of files that differ
 */
export function driftedFiles(recorded, remote) {
  return PUSHED_FILES.filter((name) => recorded[name] !== remote[name]);
}
