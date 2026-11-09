import { escapeAttr, escapeText, mapTextRuns } from "../../shared/html/escape";
import { parseText } from "../../shared/placeholders/grammar";
import { promptsFor, renderBody } from "../../shared/placeholders/render";
import type { Profile } from "../rpc/api";
import { chipLabel, chipText, placeholderAttrs } from "../editor/schema";

/**
 * "Preview as me" (wireframe 04) and the history preview (wireframe 05). Inputs are canonical HTML from the
 * editor serializer or the server sanitizer; every inserted value is escaped by the shared renderer.
 */
export function senderValues(profile: Profile | null): Record<string, string> {
  if (profile === null) return {};
  return {
    "sender.name": profile.name,
    "sender.title": profile.title,
    "sender.phone": profile.phone,
    "sender.department": profile.department,
  };
}

/** Body rendered with the caller's sender values; prompts and unknown values show as `[Label]`. */
export function previewAsMe(html: string, profile: Profile | null): string {
  const values = senderValues(profile);
  const answers = Object.fromEntries(
    promptsFor(html, values).map((field) => [field.key, `[${field.label}]`]),
  );
  return renderBody(html, { values, answers }).html;
}

/** Body with every token shown as a read-only chip, for the history preview. */
export function withChips(html: string): string {
  return mapTextRuns(html, (text) =>
    parseText(text)
      .map((segment) => {
        if (segment.kind === "text") return escapeText(segment.text);
        if (segment.kind === "escape") return "{{";
        const attrs = placeholderAttrs(segment.raw);
        if (attrs === null) return escapeText(segment.raw);
        return `<span class="ph" role="img" aria-label="${escapeAttr(chipLabel(attrs))}">${escapeText(chipText(attrs))}</span>`;
      })
      .join(""),
  );
}
