// Bundle size budget (ADR-0005 Build): Code.js under 800 KB, index.html under 400 KB.

export const KB = 1024;
export const BUDGET_BYTES = Object.freeze({
  "Code.js": 800 * KB,
  "index.html": 400 * KB,
});

/**
 * @param {Record<string, number>} sizes bytes per output file name
 * @returns {{ lines: string[], errors: string[] }} one report line per file and one error per file over budget
 */
export function checkBudget(sizes) {
  const lines = [];
  const errors = [];
  for (const [name, limit] of Object.entries(BUDGET_BYTES)) {
    const bytes = sizes[name];
    if (bytes === undefined) {
      errors.push(`${name} missing from build output.`);
      continue;
    }
    const line = `${name}: ${(bytes / KB).toFixed(1)} KB of ${String(limit / KB)} KB`;
    lines.push(line);
    if (bytes > limit) errors.push(`Over budget, ${line}`);
  }
  return { lines, errors };
}
