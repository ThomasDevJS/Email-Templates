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

const pad = (value: number) => String(value).padStart(2, "0");

/** "YYYY-MM-DD HH:MM" in the browser's time zone; the server stores UTC. "" for a blank or bad value. */
export function formatTime(iso: string): string {
  const date = new Date(iso);
  if (iso === "" || Number.isNaN(date.getTime())) return "";
  return `${String(date.getFullYear())}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

let counter = 0;

/** Unique element ID for label and ARIA references. */
export function uid(prefix: string): string {
  counter += 1;
  return `${prefix}-${String(counter)}`;
}
