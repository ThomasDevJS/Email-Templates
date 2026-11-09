// Manifest scope check (ADR-0005 Build, spec section 9): every scope must be in the default or
// conditional table, none may be forbidden, and the list must be explicit and free of duplicates.

/**
 * @typedef {{ default: readonly string[], conditional: readonly string[], forbidden: readonly string[] }} ApprovedScopes
 */

/**
 * @param {unknown} manifest parsed appsscript.json
 * @param {ApprovedScopes} approved parsed scripts/approved-scopes.json
 * @returns {string[]} one message per problem; empty when the manifest passes
 */
export function checkScopes(manifest, approved) {
  const scopes = readScopes(manifest);
  if (scopes === null)
    return ["appsscript.json has no explicit oauthScopes array of strings."];
  const allowed = new Set([...approved.default, ...approved.conditional]);
  const forbidden = new Set(approved.forbidden);
  const errors = [];
  const seen = new Set();
  for (const scope of scopes) {
    if (forbidden.has(scope)) errors.push(`Forbidden scope: ${scope}`);
    else if (!allowed.has(scope))
      errors.push(`Scope not in docs/spec.md section 9: ${scope}`);
    if (seen.has(scope)) errors.push(`Duplicate scope: ${scope}`);
    seen.add(scope);
  }
  return errors;
}

/**
 * @param {unknown} manifest
 * @returns {string[] | null}
 */
function readScopes(manifest) {
  if (typeof manifest !== "object" || manifest === null) return null;
  const scopes = /** @type {{ oauthScopes?: unknown }} */ (manifest)
    .oauthScopes;
  if (
    !Array.isArray(scopes) ||
    !scopes.every((scope) => typeof scope === "string")
  )
    return null;
  return scopes;
}
