// @vitest-environment jsdom
/**
 * Slice 8b on the dev harness: the editor header, the recipient fields, the right panel, the read-only state, the
 * image width rule and the history recipients line.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { stubLayout } from "./domStubs";
import { savedText } from "../../../src/web/views/editor";
import { restoredText } from "../../../src/web/views/history";
import {
  recipientField,
  splitAddresses,
} from "../../../src/web/views/recipients";

const INDEX = readFileSync(
  join(import.meta.dirname, "..", "..", "..", "src", "web", "index.html"),
  "utf8",
);

beforeAll(stubLayout);

afterEach(() => {
  vi.resetModules();
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

async function boot(url: string): Promise<void> {
  window.history.replaceState(null, "", url);
  const body = /<body>([\s\S]*)<\/body>/.exec(INDEX)?.[1] ?? "";
  document.body.innerHTML = body
    .replace(/<script>[\s\S]*<\/script>/, "")
    .replace(/<\?=\s*\w+\s*\?>/g, "");
  await import("../../../src/web/dev-harness");
  await import("../../../src/web/app");
}

const main = () => document.getElementById("main") as HTMLElement;
const byId = (id: string) => document.getElementById(id) as HTMLInputElement;

async function until(check: () => void): Promise<void> {
  await vi.waitFor(check, { timeout: 2000, interval: 5 });
}

function key(target: Element, name: string, init: KeyboardEventInit = {}) {
  target.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: name,
      bubbles: true,
      cancelable: true,
      ...init,
    }),
  );
}

function button(label: string, root: ParentNode = document): HTMLButtonElement {
  const found = [...root.querySelectorAll("button")].find(
    (candidate) =>
      candidate.textContent.trim() === label ||
      candidate.getAttribute("aria-label") === label,
  );
  if (found === undefined) throw new Error(`no button ${label}`);
  return found;
}

/** Types `text` into a recipient input, then presses `end` (Enter, comma, semicolon or space). */
function type(input: HTMLInputElement, text: string, end = "Enter"): void {
  input.value = text;
  key(input, end);
}

function chips(field: string): string[] {
  const box = document.getElementById(`rcpt-${field}`)?.closest(".chips-box");
  return [...(box?.querySelectorAll(".chip-text") ?? [])].map(
    (chip) => chip.textContent,
  );
}

function errorOf(field: string): string {
  return byId(`rcpt-${field}-error`).textContent;
}

interface HarnessRun {
  withSuccessHandler(handler: (value: unknown) => void): {
    rpc(op: string, args: unknown, id: string): void;
  };
}

function harnessCall(op: string, args: unknown): Promise<{ data: unknown }> {
  const run = (window as unknown as { google: { script: { run: HarnessRun } } })
    .google.script.run;
  return new Promise((resolve) => {
    run
      .withSuccessHandler((value) => {
        resolve(value as { data: unknown });
      })
      .rpc(op, args, "test");
  });
}

async function openEditor(url: string): Promise<void> {
  await boot(url);
  await until(() => {
    expect(main().querySelector(".ProseMirror")).not.toBeNull();
    expect(byId("rcpt-to")).not.toBeNull();
  });
}

describe("editor texts", () => {
  it("says when the version was saved, with the date for another day", () => {
    const now = new Date(2026, 10, 11, 16, 0);
    expect(savedText(4, new Date(2026, 10, 11, 14, 5).toISOString(), now)).toBe(
      "Saved as version 4, 2:05 PM",
    );
    expect(savedText(4, new Date(2026, 10, 9, 14, 5).toISOString(), now)).toBe(
      "Saved as version 4, Nov 9, 2:05 PM",
    );
  });

  it("names the restored fields whose stored list could not be read", () => {
    expect(restoredText(5, 2, [])).toBe("Restored as version 5.");
    expect(restoredText(5, 2, ["cc"])).toBe(
      "Restored as version 5. The Cc addresses of version 2 could not be read and were left empty. Add them again in the editor.",
    );
    expect(restoredText(5, 2, ["to", "cc", "bcc"])).toContain(
      "The To, Cc and Bcc addresses of version 2",
    );
  });

  it("splits typed and pasted addresses on commas, semicolons, spaces and line breaks", () => {
    expect(splitAddresses(" A@X.com, b@x.com;c@x.com\nd@x.com  ")).toEqual([
      "a@x.com",
      "b@x.com",
      "c@x.com",
      "d@x.com",
    ]);
    expect(splitAddresses(" ,; ")).toEqual([]);
  });
});

describe("editor layout (slice 8b)", () => {
  it("shows a skeleton while loading, then the folder path, the saved state and the panel", async () => {
    await boot("/?latency=30#/edit/T-QUOTE");
    await until(() => {
      expect(
        main().querySelector(".editor-slot")?.getAttribute("aria-busy"),
      ).toBe("true");
    });
    expect(
      main().querySelectorAll(".editor-slot .bone").length,
    ).toBeGreaterThan(5);
    await until(() => {
      expect(main().querySelector(".ProseMirror")).not.toBeNull();
    });
    expect(
      main().querySelector(".editor-slot")?.getAttribute("aria-busy"),
    ).toBe("false");
    expect(
      [...main().querySelectorAll(".crumbs li")].map((li) => li.textContent),
    ).toEqual(["Sales", "Quotes"]);
    expect(main().querySelector("h1")?.textContent).toBe("Price quote 2026");
    expect(
      [...main().querySelectorAll(".panel-heading .section-title")].map(
        (title) => title.textContent,
      ),
    ).toEqual(["Details", "The sender fills in", "Preview"]);
    expect(main().querySelector(".subject-row #subject")).not.toBeNull();
    button("Quotes").click();
    await until(() => {
      expect(window.location.hash).toBe("#/library?folder=F-QUOTES");
    });
  });

  it("says Unsaved changes after an edit and the version after a save", async () => {
    await openEditor("/?latency=0#/edit/T-QUOTE");
    const saved = main().querySelector(".saved-state") as HTMLElement;
    expect(saved.classList.contains("is-saved")).toBe(true);
    const title = byId("title");
    title.value = "Price quote 2027";
    title.dispatchEvent(new Event("input", { bubbles: true }));
    await until(() => {
      expect(saved.textContent).toBe("Unsaved changes");
    });
    expect(saved.classList.contains("is-saved")).toBe(false);
    title.value = "Price quote 2026";
    title.dispatchEvent(new Event("input", { bubbles: true }));
    await until(() => {
      expect(saved.textContent).toMatch(/^Saved as version 2, /);
    });
    title.value = "Price quote 2027";
    key(document.body, "s", { ctrlKey: true });
    await until(() => {
      expect(saved.textContent).toMatch(/^Saved as version 3, \d/);
    });
    expect(main().querySelector("h1")?.textContent).toBe("Price quote 2027");
  });

  it("lists what the sender fills in with how often, and counts problems on their tab", async () => {
    await openEditor("/?latency=0#/edit/T-QUOTE");
    await until(() => {
      expect(
        [...main().querySelectorAll(".ask-list li")].map(
          (li) => li.textContent,
        ),
      ).toEqual(["Product nameused 2 times", "Meeting dateused once"]);
    });
    const [preview, problems] = [
      ...main().querySelectorAll<HTMLElement>('[role="tab"]'),
    ];
    expect(preview?.getAttribute("aria-selected")).toBe("true");
    expect(problems?.textContent).toBe("Problems 0");
    preview?.focus();
    key(preview as HTMLElement, "ArrowRight");
    expect(document.activeElement).toBe(problems);
    expect(problems?.getAttribute("aria-selected")).toBe("true");
    key(problems as HTMLElement, "ArrowLeft");
    expect(preview?.getAttribute("aria-selected")).toBe("true");
    byId("title").value = " ";
    button("Save").click();
    await until(() => {
      expect(problems?.textContent).toBe("Problems 1");
    });
    expect(problems?.getAttribute("aria-selected")).toBe("true");
    expect(main().querySelector(".status")?.textContent).toBe(
      "Not saved. Fix the problems in the Problems tab.",
    );
  });

  it("collapses a panel section with its heading button", async () => {
    await openEditor("/?latency=0#/edit/T-QUOTE");
    const toggle = button("Details");
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    toggle.click();
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(
      byId(toggle.getAttribute("aria-controls") ?? "").classList.contains(
        "collapsed",
      ),
    ).toBe(true);
    toggle.click();
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
  });
});

describe("recipient fields (spec 5.7, 7.1)", () => {
  it("turns typed and pasted addresses into chips and removes them", async () => {
    await openEditor("/?latency=0#/edit/T-QUOTE");
    const to = byId("rcpt-to");
    type(to, "Payroll@Example.com");
    type(to, "ops@example.com", ",");
    type(to, "dock@example.com", " ");
    type(to, "yard@example.com", ";");
    to.value = "late@example.com";
    to.dispatchEvent(new FocusEvent("blur"));
    expect(chips("to")).toEqual([
      "payroll@example.com",
      "ops@example.com",
      "dock@example.com",
      "yard@example.com",
      "late@example.com",
    ]);
    key(to, "Backspace");
    expect(chips("to")).toHaveLength(4);
    button("Remove ops@example.com from To").click();
    expect(chips("to")).toEqual([
      "payroll@example.com",
      "dock@example.com",
      "yard@example.com",
    ]);
    expect(document.activeElement).toBe(to);
    const cc = byId("rcpt-cc");
    const paste = new Event("paste", { bubbles: true, cancelable: true });
    Object.defineProperty(paste, "clipboardData", {
      value: { getData: () => "a@example.com; b@partner.com\nA@example.com" },
    });
    cc.dispatchEvent(paste);
    expect(chips("cc")).toEqual(["a@example.com", "b@partner.com"]);
    const marks = [
      ...(cc.closest(".chips-box")?.querySelectorAll(".chip-mark") ?? []),
    ];
    expect(marks.map((mark) => mark.textContent)).toEqual([
      "outside example.com",
    ]);
    expect(byId("rcpt-bcc-note").textContent).toBe(
      "Hidden from the other recipients of the email.",
    );
    expect(byId("rcpt-bcc").getAttribute("aria-describedby")).toBe(
      "rcpt-bcc-error rcpt-bcc-note rcpt-help",
    );
  });

  it("shows the spec 7.1 texts under the field from the shared check", async () => {
    await openEditor("/?latency=0#/edit/T-QUOTE");
    const cc = byId("rcpt-cc");
    type(cc, "safety@example.com");
    type(cc, "not-an-address");
    expect(errorOf("cc")).toBe(
      "Cc, address 2 is not an email address. Use the form name@company.com.",
    );
    expect(cc.getAttribute("aria-invalid")).toBe("true");
    // Only a valid address can be outside the domain.
    expect(
      cc.closest(".chips-box")?.querySelectorAll(".chip-mark"),
    ).toHaveLength(0);
    expect(
      cc.closest(".chips-box")?.querySelectorAll(".chip.bad"),
    ).toHaveLength(1);
    type(byId("rcpt-bcc"), "safety@example.com");
    expect(errorOf("bcc")).toBe(
      "safety@example.com is in both Cc and Bcc. Keep it in one field.",
    );
    button("Remove not-an-address from Cc").click();
    expect(errorOf("cc")).toBe("");
    const to = byId("rcpt-to");
    type(
      to,
      Array.from({ length: 11 }, (_, n) => `p${String(n)}@example.com`).join(
        ",",
      ),
    );
    expect(errorOf("to")).toBe(
      "To holds 11 addresses. Use at most 10 per field.",
    );
  });

  it("sends to, cc and bcc on every save; an empty list clears the field", async () => {
    await openEditor("/?latency=0#/edit/T-QUOTE");
    type(byId("rcpt-to"), "payroll@example.com");
    type(byId("rcpt-bcc"), "records@partner.com");
    button("Save").click();
    await until(() => {
      expect(main().querySelector(".saved-state")?.textContent).toMatch(
        /^Saved as version 3/,
      );
    });
    const stored = async () =>
      (
        (await harnessCall("template.get", { id: "T-QUOTE" })).data as {
          item: { to: string[]; cc: string[]; bcc: string[] };
        }
      ).item;
    expect(await stored()).toMatchObject({
      to: ["payroll@example.com"],
      cc: [],
      bcc: ["records@partner.com"],
    });
    await until(() => {
      expect(main().querySelector(".rcpt-lines")?.textContent).toBe(
        "Topayroll@example.comBccrecords@partner.com",
      );
    });
    button("Remove records@partner.com from Bcc").click();
    button("Save").click();
    await until(() => {
      expect(main().querySelector(".saved-state")?.textContent).toMatch(
        /^Saved as version 4/,
      );
    });
    expect((await stored()).bcc).toEqual([]);
  });

  it("loads stored lists, and marks outside addresses as errors when the admin turned them off", async () => {
    await boot("/?latency=0&external=deny#/library");
    await harnessCall("template.update", {
      id: "T-DISCOUNT",
      baseVersion: 1,
      title: "Discount approval",
      html: "<p>x</p>",
      cc: ["boss@example.com"],
    });
    window.location.hash = "#/edit/T-DISCOUNT";
    window.dispatchEvent(new PopStateEvent("popstate"));
    await until(() => {
      expect(chips("cc")).toEqual(["boss@example.com"]);
    });
    type(byId("rcpt-bcc"), "records@partner.com");
    expect(errorOf("bcc")).toBe(
      "Bcc, address 1 is outside example.com. Your admin allows only example.com addresses. Remove it to save.",
    );
    // The server answers the same; its texts replace the local ones under the field.
    button("Save").click();
    await until(() => {
      expect(main().querySelector(".problems")?.textContent).toContain(
        "Error: Bcc, address 1 is outside example.com.",
      );
    });
    expect(errorOf("bcc")).toContain("Bcc, address 1 is outside example.com.");
  });
});

describe("read-only editor (use level)", () => {
  it("shows the template without toolbar, Save or remove buttons", async () => {
    await boot("/?latency=0#/edit/T-SUPPORT");
    await until(() => {
      expect(main().querySelector(".ProseMirror")).not.toBeNull();
    });
    expect(main().querySelector('[role="toolbar"]')).toBeNull();
    expect(
      main().querySelector(".read-only-note")?.hasAttribute("hidden"),
    ).toBe(false);
    expect(button("Save").hidden).toBe(true);
    expect(button("History").hidden).toBe(true);
    expect(
      main().querySelector(".ProseMirror")?.getAttribute("contenteditable"),
    ).toBe("false");
    expect(byId("title").readOnly).toBe(true);
    expect(byId("subject").readOnly).toBe(true);
    expect(byId("folder").disabled).toBe(true);
    expect(
      (byId("folder") as unknown as HTMLSelectElement).selectedOptions[0]
        ?.textContent,
    ).toBe("Support");
    expect(chips("to")).toEqual([]);
    expect(
      byId("rcpt-to").closest(".chips-box")?.querySelector<HTMLElement>(".hint")
        ?.hidden,
    ).toBe(false);
    expect(main().querySelector(".tag")?.textContent).toBe("support");
    expect(main().querySelectorAll(".tag-remove")).toHaveLength(0);
    expect(byId("rcpt-to").hidden).toBe(true);
    key(document.body, "s", { ctrlKey: true });
    expect(main().querySelector(".saved-state")?.textContent).not.toBe(
      "Saving...",
    );
  });

  it("shows stored addresses as chips without remove buttons", () => {
    const field = recipientField("cc", {
      domain: () => "example.com",
      readOnly: true,
      onChange: () => undefined,
      describedBy: "",
    });
    field.set(["help@example.com", "x@partner.com"]);
    expect(
      [...field.element.querySelectorAll(".chip-text")].map(
        (c) => c.textContent,
      ),
    ).toEqual(["help@example.com", "x@partner.com"]);
    expect(field.element.querySelectorAll(".chip-remove")).toHaveLength(0);
    expect(field.element.querySelector(".chip-mark")?.textContent).toBe(
      "outside example.com",
    );
    expect(field.values()).toEqual(["help@example.com", "x@partner.com"]);
  });
});

describe("image width (slice 8b fix)", () => {
  it("inserts an image with its own width, at most 600 px", async () => {
    let width = 240;
    vi.stubGlobal(
      "Image",
      class {
        naturalWidth = width;
        private readonly listeners = new Map<string, () => void>();
        addEventListener(type: string, listener: () => void) {
          this.listeners.set(type, listener);
        }
        set src(_value: string) {
          setTimeout(() => this.listeners.get("load")?.(), 0);
        }
      },
    );
    await openEditor("/?latency=0#/edit/T-DISCOUNT");
    const insert = async (src: string) => {
      button("Image").click();
      const dialog = document.querySelector('[role="dialog"]') as HTMLElement;
      expect(dialog.textContent).toContain(
        "An image wider than 600 pixels is shown 600 pixels wide.",
      );
      (dialog.querySelector("input") as HTMLInputElement).value = src;
      button("OK", dialog).click();
      await until(() => {
        expect(main().querySelector(`img[src="${src}"]`)).not.toBeNull();
      });
      return main().querySelector(`img[src="${src}"]`)?.getAttribute("width");
    };
    expect(await insert("https://example.com/small.png")).toBe("240");
    width = 1800;
    expect(await insert("https://example.com/wide.png")).toBe("600");
  });
});

describe("history recipients", () => {
  it("shows the recipients line of a version and the unreadable notice on restore", async () => {
    await boot("/?latency=0&unreadable=cc#/library");
    await harnessCall("template.update", {
      id: "T-DISCOUNT",
      baseVersion: 1,
      title: "Discount approval",
      html: "<p>x</p>",
      to: ["boss@example.com"],
      cc: ["finance@example.com"],
    });
    window.location.hash = "#/history/T-DISCOUNT";
    window.dispatchEvent(new PopStateEvent("popstate"));
    await until(() => {
      expect(main().querySelector(".sheet .rcpt-lines")?.textContent).toBe(
        "Toboss@example.comCcfinance@example.com",
      );
    });
    const list = main().querySelector('[role="listbox"]') as HTMLElement;
    key(list, "ArrowDown");
    key(list, "Enter");
    await until(() => {
      expect(main().querySelector(".sheet .rcpt-lines")).toBeNull();
    });
    key(list, "r");
    button(
      "Restore",
      document.querySelector('[role="dialog"]') as HTMLElement,
    ).click();
    await until(() => {
      expect(main().querySelector(".status")?.textContent).toBe(
        "Restored as version 3. The Cc addresses of version 1 could not be read and were left empty. Add them again in the editor.",
      );
    });
  });
});

describe("unsaved-changes guard", () => {
  const dialog = () => document.querySelector<HTMLElement>('[role="dialog"]');

  function edit(): void {
    const title = byId("title");
    title.value = "Changed title";
    title.dispatchEvent(new Event("input", { bubbles: true }));
  }

  async function storedTitle(id: string): Promise<string> {
    return (
      (await harnessCall("template.get", { id })).data as {
        item: { title: string };
      }
    ).item.title;
  }

  /** Every way out of the editor inside the app; each one asks while the form has changes. */
  const exits: readonly (readonly [string, () => void])[] = [
    [
      "sidebar All templates",
      () => {
        document.querySelector<HTMLElement>("[data-nav=library]")?.click();
      },
    ],
    [
      "sidebar Favorites",
      () => {
        document.querySelector<HTMLElement>("[data-nav=favorites]")?.click();
      },
    ],
    [
      "sidebar Trash",
      () => {
        document.querySelector<HTMLElement>("[data-nav=trash]")?.click();
      },
    ],
    [
      "folder tree",
      () => {
        document.querySelector<HTMLElement>("#side .tree-item")?.click();
      },
    ],
    [
      "breadcrumb",
      () => {
        button("Quotes").click();
      },
    ],
    [
      "History",
      () => {
        button("History").click();
      },
    ],
    [
      "browser Back to the library",
      () => {
        window.history.replaceState(null, "", "#/library");
        window.dispatchEvent(new PopStateEvent("popstate"));
      },
    ],
    [
      "opening another template",
      () => {
        window.history.replaceState(null, "", "#/edit/T-DISCOUNT");
        window.dispatchEvent(new PopStateEvent("popstate"));
      },
    ],
  ];

  for (const [name, leave] of exits)
    it(`asks before leaving by the ${name}; Keep editing stays`, async () => {
      await openEditor("/?latency=0#/edit/T-QUOTE");
      edit();
      leave();
      await until(() => {
        expect(dialog()?.querySelector("h2")?.textContent).toBe(
          "Leave without saving?",
        );
      });
      expect(
        [...(dialog()?.querySelectorAll("button") ?? [])].map(
          (b) => b.textContent,
        ),
      ).toEqual(["Keep editing", "Discard changes", "Save and leave"]);
      expect(document.activeElement?.textContent).toBe("Keep editing");
      button("Keep editing").click();
      await until(() => {
        expect(dialog()).toBeNull();
      });
      expect(window.location.hash).toBe("#/edit/T-QUOTE");
      expect(byId("title").value).toBe("Changed title");
    });

  it("leaves without a question when nothing changed", async () => {
    await openEditor("/?latency=0#/edit/T-QUOTE");
    button("History").click();
    await until(() => {
      expect(window.location.hash).toBe("#/history/T-QUOTE");
    });
    expect(dialog()).toBeNull();
  });

  it("leaves without a question for a caller without edit", async () => {
    await openEditor("/?latency=0#/edit/T-SUPPORT");
    edit();
    document.querySelector<HTMLElement>("[data-nav=library]")?.click();
    await until(() => {
      expect(window.location.hash).toBe("#/library");
    });
    expect(dialog()).toBeNull();
  });

  it("Discard changes leaves and saves nothing", async () => {
    await openEditor("/?latency=0#/edit/T-QUOTE");
    edit();
    button("Quotes").click();
    button("Discard changes").click();
    await until(() => {
      expect(window.location.hash).toBe("#/library?folder=F-QUOTES");
    });
    expect(await storedTitle("T-QUOTE")).toBe("Price quote 2026");
  });

  it("Save and leave saves, then leaves", async () => {
    await openEditor("/?latency=0#/edit/T-QUOTE");
    edit();
    button("History").click();
    button("Save and leave").click();
    await until(() => {
      expect(window.location.hash).toBe("#/history/T-QUOTE");
    });
    expect(await storedTitle("T-QUOTE")).toBe("Changed title");
  });

  it("Back held by the question moves on after Discard changes", async () => {
    await openEditor("/?latency=0#/edit/T-QUOTE");
    edit();
    window.history.replaceState(null, "", "#/edit/T-DISCOUNT");
    window.dispatchEvent(new PopStateEvent("popstate"));
    // The address returns to the open template while the question shows.
    expect(window.location.hash).toBe("#/edit/T-QUOTE");
    button("Discard changes").click();
    await until(() => {
      expect(window.location.hash).toBe("#/edit/T-DISCOUNT");
      expect(byId("title").value).toBe("Discount approval");
    });
  });

  it("stays when Save and leave fails", async () => {
    await openEditor(
      "/?latency=0&fail=BUSY&failOp=template.update#/edit/T-QUOTE",
    );
    edit();
    document.querySelector<HTMLElement>("[data-nav=library]")?.click();
    button("Save and leave").click();
    await until(() => {
      expect(document.querySelector(".toast")?.textContent).toContain(
        "Busy, try again.",
      );
    });
    expect(window.location.hash).toBe("#/edit/T-QUOTE");
    expect(main().querySelector(".saved-state")?.textContent).toBe(
      "Unsaved changes",
    );
  });

  it("stays on a conflict and shows the conflict dialog", async () => {
    await openEditor("/?latency=0#/edit/T-QUOTE");
    await harnessCall("template.update", {
      id: "T-QUOTE",
      baseVersion: 2,
      title: "Other tab",
      html: "<p>theirs</p>",
    });
    edit();
    button("History").click();
    button("Save and leave").click();
    await until(() => {
      expect(dialog()?.querySelector("h2")?.textContent).toBe(
        "This template changed",
      );
    });
    expect(window.location.hash).toBe("#/edit/T-QUOTE");
  });

  it("asks the browser before the page closes while changes are unsaved", async () => {
    await openEditor("/?latency=0#/edit/T-QUOTE");
    const unload = () => {
      const event = new Event("beforeunload", { cancelable: true });
      window.dispatchEvent(event);
      return event.defaultPrevented;
    };
    expect(unload()).toBe(false);
    edit();
    expect(unload()).toBe(true);
  });
});
