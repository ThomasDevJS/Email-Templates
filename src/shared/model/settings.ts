/**
 * Admin settings (D29, spec 5.8, ADR-0008): the fixed list of names, values and defaults. Stored in the optional
 * `settings` object of `index.json`; an absent object or entry reads as the default, so nothing is written on read.
 */
export const SETTINGS = {
  personalTemplates: { values: ["on", "off"], default: "off" },
  recipientsExternal: { values: ["allow", "deny"], default: "allow" },
  /** `open`: a row whose template has fields shows Open (the details card) in place of the one-click button. */
  rowButton: { values: ["insert", "open"], default: "insert" },
} as const;

/** DENIED text for a target in a private tree while personal templates are off (spec 6, 7). */
export const PERSONAL_OFF_TEXT =
  "Personal templates are turned off by your admin.";

export type SettingName = keyof typeof SETTINGS;
export type SettingValue<N extends SettingName = SettingName> =
  (typeof SETTINGS)[N]["values"][number];

export interface SettingEntry<N extends SettingName = SettingName> {
  readonly value: SettingValue<N>;
  /** "" while the default was never changed. */
  readonly updatedAt: string;
  readonly updatedBy: string;
}

export type Settings = { readonly [N in SettingName]: SettingEntry<N> };
/** As stored: the object and each entry may be absent. */
export type StoredSettings = Partial<Settings>;

export function isSettingName(name: unknown): name is SettingName {
  return (
    typeof name === "string" &&
    Object.prototype.hasOwnProperty.call(SETTINGS, name)
  );
}

export function isSettingValue<N extends SettingName>(
  name: N,
  value: unknown,
): value is SettingValue<N> {
  return (SETTINGS[name].values as readonly unknown[]).includes(value);
}

function entryOf<N extends SettingName>(
  name: N,
  stored: StoredSettings | undefined,
): SettingEntry<N> {
  const entry = stored?.[name];
  return (
    entry ?? { value: SETTINGS[name].default, updatedAt: "", updatedBy: "" }
  );
}

/** Every setting with its default filled in. */
export function settingsOf(stored: StoredSettings | undefined): Settings {
  return {
    personalTemplates: entryOf("personalTemplates", stored),
    recipientsExternal: entryOf("recipientsExternal", stored),
    rowButton: entryOf("rowButton", stored),
  };
}

export function settingValue<N extends SettingName>(
  stored: StoredSettings | undefined,
  name: N,
): SettingValue<N> {
  return entryOf(name, stored).value;
}

export function personalTemplatesOn(
  stored: StoredSettings | undefined,
): boolean {
  return settingValue(stored, "personalTemplates") === "on";
}

/** Shape check of a stored `settings` value (spec 5.8): "" when usable, else the first problem. */
export function settingsProblem(value: unknown): string {
  if (value === undefined) return "";
  if (typeof value !== "object" || value === null || Array.isArray(value))
    return "settings must be a record";
  for (const [name, entry] of Object.entries(value)) {
    if (!isSettingName(name)) return `settings has an unknown name ${name}`;
    const record = entry as Record<string, unknown> | null;
    if (
      typeof record !== "object" ||
      record === null ||
      !isSettingValue(name, record["value"]) ||
      typeof record["updatedAt"] !== "string" ||
      typeof record["updatedBy"] !== "string"
    )
      return `settings ${name} has a bad entry`;
  }
  return "";
}

/** "on or off", "allow or deny": the allowed values in words, for the VALIDATION text (spec 7.3). */
export function allowedWords(name: SettingName): string {
  return SETTINGS[name].values.join(" or ");
}
