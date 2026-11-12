// Top-level stubs for the IIFE bundle (ADR-0005 Build). Apps Script only sees top-level function
// declarations, so each export of src/entry.ts gets `function name(...args) { return App.name(...args); }`.

const IDENTIFIER = /^[A-Za-z$][\w$]*$/;

/**
 * @param {readonly string[]} names exported names of the bundle entry
 * @param {string} globalName IIFE global that holds the exports
 * @returns {string} JavaScript source with one stub per name, sorted
 */
export function generateStubs(names, globalName) {
  const sorted = [...names].sort();
  for (const [index, name] of sorted.entries()) {
    if (!IDENTIFIER.test(name)) {
      throw new Error(`Export "${name}" is not a plain identifier.`);
    }
    if (name === "default")
      throw new Error(
        "Default exports have no Apps Script name; use a named export.",
      );
    if (name.endsWith("_")) {
      throw new Error(
        `Export "${name}" ends with "_"; Apps Script would hide it.`,
      );
    }
    if (name === globalName)
      throw new Error(`Export "${name}" collides with the bundle global.`);
    if (sorted[index + 1] === name)
      throw new Error(`Export "${name}" appears twice.`);
  }
  return sorted
    .map(
      (name) =>
        `function ${name}(...args) {\n  return ${globalName}.${name}(...args);\n}\n`,
    )
    .join("");
}
