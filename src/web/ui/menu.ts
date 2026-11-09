import { h } from "./dom";

/**
 * Popup menu (`role="menu"`) for toolbar menus and the placeholder picker. Arrow keys, Home and End move,
 * Enter or Space picks, Esc and Tab close. Focus goes back to `returnFocus` on close.
 */
export interface MenuItem {
  readonly label: string;
  readonly checked?: boolean;
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
        class: "menu-item",
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
    ...buttons,
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
  menu.style.left = `${String(Math.round(rect.left + window.scrollX))}px`;
  menu.style.top = `${String(Math.round(rect.bottom + window.scrollY + 4))}px`;
  document.body.append(menu);
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
