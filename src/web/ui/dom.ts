/** Small element builder. Props starting with `on` and holding a function become event listeners. */
export type Child = Node | string | null | undefined | false;
export type Props = Readonly<
  Record<string, string | number | boolean | null | undefined | EventListener>
>;

function applyProp(
  element: HTMLElement,
  key: string,
  value: Props[string],
): void {
  if (typeof value === "function") {
    element.addEventListener(key.slice(2), value);
  } else if (value === true) {
    element.setAttribute(key, "");
  } else if (value !== false && value !== null && value !== undefined) {
    element.setAttribute(key, String(value));
  }
}

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Props = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  for (const [key, value] of Object.entries(props))
    applyProp(element, key, value);
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    element.append(child);
  }
  return element;
}

/** Replaces all children of `parent`. */
export function replace(parent: Element, ...children: Child[]): void {
  parent.replaceChildren(
    ...children.filter(
      (child): child is Node | string =>
        child !== null && child !== undefined && child !== false,
    ),
  );
}

/**
 * "Nov 9, 2:05 PM" in the browser's time zone, with the year only for another year than `now`'s; `"time"` gives
 * "2:05 PM". The server stores UTC. "" for a blank or bad value.
 */
export function formatTime(
  iso: string,
  parts: "date" | "time" = "date",
  now: Date = new Date(),
): string {
  const date = new Date(iso);
  if (iso === "" || Number.isNaN(date.getTime())) return "";
  const clock = { hour: "numeric", minute: "2-digit" } as const;
  const day = {
    month: "short",
    day: "numeric",
    year:
      date.getFullYear() === now.getFullYear()
        ? undefined
        : ("numeric" as const),
  } as const;
  // ICU puts a narrow no-break space before AM and PM; a plain space keeps the text searchable and testable.
  return new Intl.DateTimeFormat(
    "en-US",
    parts === "time" ? clock : { ...day, ...clock },
  )
    .format(date)
    .replace(/\u202f/g, " ");
}

let counter = 0;

/** Unique element ID for label and ARIA references. */
export function uid(prefix: string): string {
  counter += 1;
  return `${prefix}-${String(counter)}`;
}
