import type { AccessLevel } from "../permissions/levels";
import type { AppliedRecipients } from "./recipients";

/**
 * Payloads of the sidebar ops (spec section 4.1). Server handlers build them; the add-on caches `SidebarHome` in
 * its User Cache (`view:*`) and reads `ApplyResult` on Insert.
 */
export interface SidebarFolder {
  readonly id: string;
  readonly name: string;
  /** Nearest visible parent, or "" when the folder shows at the top of the sidebar. */
  readonly parentId: string;
  /** Live templates the caller can use in this folder and its visible subfolders. */
  readonly count: number;
}

export interface SidebarTemplate {
  readonly id: string;
  readonly folderId: string;
  readonly title: string;
  /** Template subject with its tokens (spec 5.6); "" when the template sets none. */
  readonly subject: string;
  /** First 80 characters of the plain-text snippet (wireframe 01). */
  readonly snippet: string;
  readonly version: number;
  /** Normalized prompt labels; `n fields to fill` on the home and folder cards. */
  readonly prompts: readonly string[];
  readonly level: AccessLevel;
  /**
   * Counts of the To, Cc and Bcc addresses Insert may add (spec 5.7, `deny` applied), never the addresses. Absent
   * when there are none, and in views cached before slice 9.
   */
  readonly rc?: readonly [number, number, number];
}

export interface SidebarHome {
  /** Top-level visible folders with counts (AC 1). */
  readonly folders: readonly SidebarFolder[];
  /** Visible folders below the top level, for the folder card. */
  readonly subfolders: readonly SidebarFolder[];
  readonly templates: readonly SidebarTemplate[];
  /** Template IDs. Empty until slice 5. */
  readonly favorites: readonly string[];
  /** Template IDs. Empty until slice 5. */
  readonly recent: readonly string[];
  /** Admin setting (D29): picks the empty-card text (spec 7.2). */
  readonly personalTemplates: "on" | "off";
  /** Admin setting `rowButton` (spec 5.8); absent in views cached before it existed, read as `insert`. */
  readonly rowButton?: "insert" | "open";
}

/** Caller's Directory values (ADR-0004 Sender values). Blank means unresolved. */
export interface Sender {
  readonly name: string;
  readonly title: string;
  readonly phone: string;
  readonly department: string;
}

/** Recipients (spec 5.7) travel on every call, outside the `knownVersion` rule; the add-on never caches them. */
export interface ApplyResult extends AppliedRecipients {
  readonly id: string;
  readonly title: string;
  readonly version: number;
  /** Sanitized body, or null when `knownVersion` equals `version` and the add-on holds it already. */
  readonly html: string | null;
  /** Template subject (spec 5.6), null under the same rule as `html`. "" leaves the draft subject alone. */
  readonly subject: string | null;
  readonly sender: Sender;
  /** Directory given name of the one internal To recipient; blank when unknown. */
  readonly recipientFirstName: string;
}

/** Placeholder values for `renderBody`, keyed by registry name. */
export function variableValues(
  sender: Sender,
  recipientFirstName: string,
): Readonly<Record<string, string>> {
  return {
    "sender.name": sender.name,
    "sender.title": sender.title,
    "sender.phone": sender.phone,
    "sender.department": sender.department,
    "recipient.first_name": recipientFirstName,
  };
}

/** Snippet length on the sidebar cards (wireframe 01). */
export const SIDEBAR_SNIPPET_CHARS = 80;
