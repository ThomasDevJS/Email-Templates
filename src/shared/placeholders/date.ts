/**
 * A picked date as MM/DD/YYYY (spec 5.9, ADR-0004 Amendment 2026-11-12 section 3). `raw` is the picker's
 * `msSinceEpoch`, a number or a numeric string. The ms is rounded to the nearest whole UTC day and read with UTC
 * getters only, so neither the script's nor the user's time zone moves the day. "" means no date.
 */
const DAY_MS = 86_400_000;

const pad = (value: number): string => String(value).padStart(2, "0");

const TYPED = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;

/**
 * A date written as M/D/YYYY or MM/DD/YYYY, as midnight UTC ms; null when it is not a real calendar day in years
 * 1000 to 9999 (02/30, 13/01). Used by the card's text-box fallback and to set a picked date back on a card.
 */
export function typedDateMs(text: string): number | null {
  const parts = TYPED.exec(text.trim());
  if (parts === null) return null;
  const [, month = "", day = "", year = ""] = parts;
  const ms = Date.UTC(Number(year), Number(month) - 1, Number(day));
  const same =
    dateText(ms) === `${pad(Number(month))}/${pad(Number(day))}/${year}`;
  return same ? ms : null;
}

export function dateText(raw: unknown): string {
  if (typeof raw !== "number" && typeof raw !== "string") return "";
  if (typeof raw === "string" && raw.trim() === "") return "";
  const ms = Number(raw);
  if (!Number.isFinite(ms)) return "";
  const date = new Date(Math.round(ms / DAY_MS) * DAY_MS);
  const year = date.getUTCFullYear();
  if (!(year >= 1000 && year <= 9999)) return "";
  return `${pad(date.getUTCMonth() + 1)}/${pad(date.getUTCDate())}/${String(year)}`;
}
