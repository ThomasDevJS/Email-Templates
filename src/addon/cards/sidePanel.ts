import type { Entry } from "../event";
import type { SectionSpec } from "./spec";

/** How to insert, for the side panel (spec 7.2 footer hint, reworded in slice 12). */
export const TOOLBAR_HINT =
  "To insert a template, open a draft and use the Migway Templates button in the draft's toolbar.";

/**
 * The side panel cannot insert (interim fix of spec 13.7), so every card there that lists or previews templates ends
 * with the way to insert. The one place the side-panel insert work replaces.
 */
export function sidePanelHint(entry: Entry): SectionSpec[] {
  return entry === "compose"
    ? []
    : [{ widgets: [{ kind: "text", text: TOOLBAR_HINT }] }];
}
