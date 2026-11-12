import { h } from "./dom";

/**
 * Popup menu (`role="menu"`) for toolbar menus and the placeholder picker. Arrow keys, Home and End move,
 * Enter or Space picks, Esc and Tab close. Focus goes back to `returnFocus` on close.
 */
export interface MenuItem {
  readonly label: string;
  readonly checked?: boolean;
  /** Shown in red after a divider (Delete). */
  readonly destructive?: boolean;
  /** CSS font family the item's label is drawn in (the font picker shows each face). */
  readonly font?: string;
  readonly run: () => void;
}

export interface MenuOptions {
  readonly label: string;
  readonly anchor: HTMLElement;
  readonly items: readonly MenuItem[];
  readonly returnFocus: () => void;
  /** Runs when the menu closes without a pick. */
  readonly onDismiss?: () => void;
}

function move(items: HTMLElement[], current: number, key: string): number {
  const last = items.length - 1;
  if (key === "ArrowDown") return current >= last ? 0 : current + 1;
  if (key === "ArrowUp") return current <= 0 ? last : current - 1;
  if (key === "Home") return 0;
  if (key === "End") return last;
  return -1;
}

let openMenuClose: (() => void) | null = null;

export function openMenu(options: MenuOptions): HTMLElement {
  openMenuClose?.();
  let done = false;
  const close = (picked: boolean) => {
    if (done) return;
    done = true;
    openMenuClose = null;
    menu.remove();
    options.anchor.setAttribute("aria-expanded", "false");
    document.removeEventListener("mousedown", outside, true);
    if (!picked) options.onDismiss?.();
    options.returnFocus();
  };
  const buttons = options.items.map((item) =>
    h(
      "div",
      {
        role: item.checked === undefined ? "menuitem" : "menuitemradio",
        "aria-checked":
          item.checked === undefined ? undefined : String(item.checked),
        tabindex: "-1",
        class:
          item.destructive === true ? "menu-item destructive" : "menu-item",
        style:
          item.font === undefined ? undefined : `font-family: ${item.font}`,
        onclick: () => {
          close(true);
          item.run();
        },
      },
      item.label,
    ),
  );
  const menu = h(
    "div",
    { class: "menu", role: "menu", "aria-label": options.label },
    ...buttons.flatMap((button, i) =>
      options.items[i]?.destructive === true && i > 0
        ? [h("div", { role: "separator", class: "menu-divider" }), button]
        : [button],
    ),
  );
  const outside = (event: Event) => {
    if (!menu.contains(event.target as Node) && event.target !== options.anchor)
      close(false);
  };
  menu.addEventListener("keydown", (event) => {
    const current = buttons.indexOf(document.activeElement as HTMLDivElement);
    const next = move(buttons, current, event.key);
    if (next >= 0) {
      event.preventDefault();
      buttons[next]?.focus();
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      buttons[current]?.click();
    } else if (event.key === "Escape" || event.key === "Tab") {
      event.preventDefault();
      close(false);
    }
  });
  const rect = options.anchor.getBoundingClientRect();
  menu.style.top = `${String(Math.round(rect.bottom + window.scrollY + 4))}px`;
  document.body.append(menu);
  // A menu at the right edge (the row menu) opens leftwards, so it never overflows the page.
  const left = Math.max(
    0,
    Math.min(
      rect.left,
      document.documentElement.clientWidth - menu.offsetWidth - 8,
    ),
  );
  menu.style.left = `${String(Math.round(left + window.scrollX))}px`;
  options.anchor.setAttribute("aria-expanded", "true");
  document.addEventListener("mousedown", outside, true);
  openMenuClose = () => {
    close(false);
  };
  (
    buttons.find((_, i) => options.items[i]?.checked === true) ?? buttons[0]
  )?.focus();
  return menu;
}
