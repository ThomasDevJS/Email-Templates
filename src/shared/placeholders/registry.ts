/** Closed registry of variable names in v1 (ADR-0004 Grammar). */

export interface PlaceholderInfo {
  readonly name: string;
  /** Chip and picker text. */
  readonly label: string;
  /** Label of the implicit prompt when the value is unresolved and has no fallback (ADR-0004 Apply semantics 3). */
  readonly promptLabel: string;
}

export const REGISTRY: readonly PlaceholderInfo[] = [
  { name: "sender.name", label: "Sender name", promptLabel: "Your name" },
  { name: "sender.title", label: "Sender title", promptLabel: "Your title" },
  { name: "sender.phone", label: "Sender phone", promptLabel: "Your phone" },
  {
    name: "sender.department",
    label: "Sender department",
    promptLabel: "Your department",
  },
  {
    name: "recipient.first_name",
    label: "Recipient first name",
    promptLabel: "Recipient first name",
  },
];

export const PLACEHOLDER_NAMES: readonly string[] = REGISTRY.map(
  (entry) => entry.name,
);

export function placeholderInfo(name: string): PlaceholderInfo | undefined {
  return REGISTRY.find((entry) => entry.name === name);
}

export function isKnownName(name: string): boolean {
  return placeholderInfo(name) !== undefined;
}
