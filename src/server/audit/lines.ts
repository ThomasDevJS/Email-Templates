import type { AuditEvent } from "../../shared/model/data";

/**
 * Month files `audit/YYYY-MM.jsonl` hold one event per line (ADR-0002 Audit storage). A crash between the append
 * and the `pendingAudit` cleanup repeats events; appends skip known IDs and readers drop duplicates.
 */
export function monthOf(isoTs: string): string {
  return isoTs.slice(0, 7);
}

function idOfLine(line: string): string {
  try {
    const parsed = JSON.parse(line) as { id?: unknown };
    return typeof parsed.id === "string" ? parsed.id : "";
  } catch {
    return "";
  }
}

function idsInText(text: string): Set<string> {
  return new Set(
    text
      .split("\n")
      .filter((line) => line.trim() !== "")
      .map(idOfLine),
  );
}

/** Existing text plus one line per event whose ID the text does not hold yet. */
export function appendUnique(
  existing: string,
  events: readonly AuditEvent[],
): { text: string; added: number } {
  const known = idsInText(existing);
  const lines: string[] = [];
  for (const event of events) {
    if (known.has(event.id)) continue;
    known.add(event.id);
    lines.push(JSON.stringify(event));
  }
  if (lines.length === 0) return { text: existing, added: 0 };
  const prefix =
    existing === "" || existing.endsWith("\n") ? existing : `${existing}\n`;
  return { text: `${prefix}${lines.join("\n")}\n`, added: lines.length };
}

export function groupByMonth(
  events: readonly AuditEvent[],
): Map<string, AuditEvent[]> {
  const months = new Map<string, AuditEvent[]>();
  for (const event of events) {
    const month = monthOf(event.ts);
    const list = months.get(month) ?? [];
    list.push(event);
    months.set(month, list);
  }
  return months;
}
