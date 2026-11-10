/**
 * Shape checks of the stored files (spec 5.5) as read from Drive: `index.json`, `favorites.json`, `usage.json`.
 * Each returns "" when the value can be used, else the first problem. The store runs them on every Drive read of
 * these files and on backup copies before a restore, so a damaged file is refused before anything uses it.
 */
type Json = Readonly<Record<string, unknown>>;

function isRecord(value: unknown): value is Json {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const isInt = (value: unknown) => Number.isInteger(value);
const isString = (value: unknown) => typeof value === "string";

/** First record of `list` lacking a field of the right type, as "<what> <n> needs <field>". */
function records(
  list: unknown,
  what: string,
  fields: Readonly<Record<string, (value: unknown) => boolean>>,
): string {
  if (!Array.isArray(list)) return `${what}s must be a list`;
  for (const [n, entry] of list.entries()) {
    if (!isRecord(entry)) return `${what} ${String(n + 1)} is not a record`;
    for (const [field, ok] of Object.entries(fields))
      if (!ok(entry[field])) return `${what} ${String(n + 1)} needs ${field}`;
  }
  return "";
}

export function indexProblem(doc: unknown): string {
  if (!isRecord(doc)) return "not a record";
  if (doc["schemaVersion"] !== 1) return "schemaVersion must be 1";
  if (!isInt(doc["rev"])) return "rev must be an integer";
  return (
    records(doc["folders"], "folder", {
      id: isString,
      parentId: isString,
      name: isString,
      kind: (v) => v === "shared" || v === "private",
      ownerEmail: isString,
      deletedAt: isString,
      version: isInt,
    }) ||
    records(doc["grants"], "grant", {
      id: isString,
      folderId: isString,
      principalType: isString,
      principalKey: isString,
      level: (v) => v === "use" || v === "edit" || v === "manage",
    }) ||
    records(doc["items"], "item", {
      id: isString,
      folderId: isString,
      title: isString,
      tags: Array.isArray,
      currentVersion: isInt,
      bodyFileId: isString,
      deletedAt: isString,
      version: isInt,
    }) ||
    records(doc["pendingAudit"], "pendingAudit event", {
      id: isString,
      ts: isString,
    })
  );
}

function mapOf(
  value: unknown,
  name: string,
  ok: (entry: unknown) => boolean,
): string {
  if (!isRecord(value)) return `${name} must be a record`;
  const bad = Object.keys(value).find((key) => !ok(value[key]));
  return bad === undefined ? "" : `${name} has a bad entry`;
}

const stringList = (value: unknown) =>
  Array.isArray(value) && value.every(isString);

export function favoritesProblem(doc: unknown): string {
  if (!isRecord(doc)) return "not a record";
  if (!isInt(doc["rev"])) return "rev must be an integer";
  return mapOf(doc["byUser"], "byUser", stringList);
}

export function usageProblem(doc: unknown): string {
  if (!isRecord(doc)) return "not a record";
  if (!isInt(doc["rev"])) return "rev must be an integer";
  return (
    mapOf(
      doc["items"],
      "items",
      (entry) =>
        isRecord(entry) &&
        isInt(entry["applyCount"]) &&
        isString(entry["lastUsedAt"]),
    ) || mapOf(doc["recent"], "recent", stringList)
  );
}
