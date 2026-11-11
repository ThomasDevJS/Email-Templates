import { ErrorCode } from "../../shared/errors/codes";
import type { Item } from "../../shared/model/data";
import {
  RECIPIENT_FIELDS,
  recipientsOf,
  validateRecipients,
  type RecipientField,
  type RecipientPolicy,
  type RecipientProblem,
  type Recipients,
} from "../../shared/model/recipients";
import { TAGS_MAX, TAG_MAX, TITLE_MAX } from "../../shared/model/validate";
import { atLeast } from "../../shared/permissions/levels";
import { domainOf } from "../../shared/permissions/principals";
import { SUBJECT_MAX } from "../../shared/placeholders/subject";
import { scanBody } from "../../shared/placeholders/validate";
import type { FolderRow, Me } from "../rpc/api";
import { imageWidth, insertNode, newTable, setLink } from "../editor/commands";
import { pickerItems, subjectPickerItems } from "../editor/picker";
import { safeHref, schema } from "../editor/schema";
import { backslashProblems } from "../editor/serialize";
import { createEditor, type Editor } from "../editor/setup";
import { createToolbar } from "../editor/toolbar";
import { editableFolders, folderPath } from "../library/model";
import { formatTime, h, replace, uid } from "../ui/dom";
import { openDialog, promptText } from "../ui/dialog";
import { icon } from "../ui/icons";
import { openMenu } from "../ui/menu";
import { toRpcError } from "../ui/status";
import type { AppContext, View } from "./context";
import { problemList, type ListedProblem } from "./problems";
import { previewAsMe, promptUses, subjectAsMe, usedText } from "./preview";
import { recipientBlock, recipientField, type ChipField } from "./recipients";
import { tagEditor, type TagEditor } from "./tags";

/**
 * Editor (screen 4, flow 4.2 save; design system direction A): header with the folder path, the saved state,
 * History and Save; the toolbar; the email on a sheet with the subject line on top; the right panel with Details
 * (title, folder, tags, To, Cc, Bcc), "The sender fills in" and the tabs "Preview as me" and "Problems". Save by
 * button or Ctrl+S; disabled while saving. A stale base version opens the conflict dialog with three choices; nothing
 * is overwritten silently. The subject is a plain input: tokens are typed as text, and "Insert field" inserts token
 * text there while it has focus. A caller with `use` only sees the template read-only.
 */
interface Loaded {
  readonly id: string;
  readonly version: number;
  readonly title: string;
  readonly subject: string;
  readonly folderId: string;
  readonly tags: readonly string[];
  readonly recipients: Recipients;
  readonly html: string;
  readonly updatedAt: string;
}

const EDITOR_ID = "editor-body";
/** An image that has not loaded by then is inserted without a width. */
const IMAGE_WAIT_MS = 5000;

function blank(folderId: string): Loaded {
  return {
    id: "",
    version: 0,
    title: "",
    subject: "",
    folderId,
    tags: [],
    recipients: { to: [], cc: [], bcc: [] },
    html: "",
    updatedAt: "",
  };
}

function fromItem(item: Item, html: string): Loaded {
  return {
    id: item.id,
    version: item.version,
    title: item.title,
    subject: item.subject,
    folderId: item.folderId,
    tags: item.tags,
    recipients: recipientsOf(item),
    html,
    updatedAt: item.updatedAt,
  };
}

/** "Saved as version 4, 2:05 PM" for today, with the date for an older save (local time). */
export function savedText(
  version: number,
  iso: string,
  now: Date = new Date(),
): string {
  const today = new Date(iso).toDateString() === now.toDateString();
  return `Saved as version ${String(version)}, ${formatTime(iso, today ? "time" : "date", now)}`;
}

/** Problems in the subject name the field (wireframe 04): "Subject: Unknown placeholder ...". */
function fieldMessage(problem: { message?: unknown; field?: unknown }) {
  const message = String(problem.message);
  return problem.field === "subject" ? `Subject: ${message}` : message;
}

function detailProblems(
  details: unknown,
): { message?: unknown; field?: unknown }[] {
  const problems = (details as { problems?: unknown } | undefined)?.problems;
  return Array.isArray(problems)
    ? (problems as { message?: unknown; field?: unknown }[])
    : [];
}

function serverProblems(details: unknown): ListedProblem[] {
  return detailProblems(details).map((problem) => ({
    kind: "error",
    message: fieldMessage(problem),
  }));
}

/** The server's recipient problems (spec 7.1), shown under their fields. */
function serverRecipientProblems(details: unknown): RecipientProblem[] {
  return detailProblems(details).filter((problem) =>
    (RECIPIENT_FIELDS as readonly unknown[]).includes(problem.field),
  ) as unknown as RecipientProblem[];
}

function warningsOf(html: string, subject: string): ListedProblem[] {
  return scanBody(html, [], subject.trim()).warnings.map((warning) => ({
    kind: "warning",
    message: fieldMessage(warning),
  }));
}

/** The image's own width in pixels, 0 when it does not load in time. */
function naturalWidth(src: string): Promise<number> {
  return new Promise((resolve) => {
    const image = new Image();
    const done = (width: number) => {
      window.clearTimeout(timer);
      resolve(width);
    };
    const timer = window.setTimeout(() => {
      done(0);
    }, IMAGE_WAIT_MS);
    image.addEventListener("load", () => {
      done(image.naturalWidth);
    });
    image.addEventListener("error", () => {
      done(0);
    });
    image.src = src;
  });
}

/** Loading state shaped like the editor: toolbar, sheet with a subject line and text, panel rows. */
function editorSkeleton(): HTMLElement {
  const bone = (width: string) => h("span", { class: `bone ${width}` });
  return h(
    "div",
    { class: "editor-work", "aria-hidden": "true" },
    h(
      "div",
      { class: "doc" },
      h("div", { class: "toolbar skeleton-bar" }, bone("w40")),
      h(
        "div",
        { class: "sheet editor-sheet" },
        h("div", { class: "subject-row" }, bone("w40")),
        h(
          "div",
          { class: "skeleton-text" },
          ...["w40", "w90", "w80", "w60", "w90", "w20"].map(bone),
        ),
      ),
    ),
    h(
      "div",
      { class: "editor-panel skeleton-text" },
      ...["w40", "w90", "w90", "w60", "w90", "w80"].map(bone),
    ),
  );
}

/**
 * A panel section. Under 860 px the panel moves below the sheet and each section collapses with its heading button;
 * on wide screens the heading is plain text and the section stays open.
 */
function panelSection(
  title: string,
  content: readonly HTMLElement[],
  quietHeading = false,
): HTMLElement {
  const bodyId = uid("panel-section");
  const body = h("div", { id: bodyId, class: "section-body" }, ...content);
  const toggle = h(
    "button",
    {
      type: "button",
      class: "section-toggle",
      "aria-expanded": "true",
      "aria-controls": bodyId,
    },
    icon("down"),
    title,
  );
  toggle.addEventListener("click", () => {
    const open = toggle.getAttribute("aria-expanded") !== "true";
    toggle.setAttribute("aria-expanded", String(open));
    body.classList.toggle("collapsed", !open);
  });
  return h(
    "section",
    { class: "panel-section" },
    h(
      "h2",
      { class: quietHeading ? "panel-heading quiet" : "panel-heading" },
      toggle,
      h("span", { class: "section-title" }, title),
    ),
    body,
  );
}

/** "Preview as me" and "Problems" as an ARIA tab list; arrows move between the two tabs. */
function panelTabs(preview: HTMLElement, problems: HTMLElement) {
  const count = h("span", { class: "tab-count" }, "0");
  const tabs = [
    h(
      "button",
      { type: "button", role: "tab", id: "tab-preview" },
      "Preview as me",
    ),
    h(
      "button",
      { type: "button", role: "tab", id: "tab-problems" },
      "Problems ",
      count,
    ),
  ];
  const panels = [preview, problems].map((content, i) =>
    h(
      "div",
      {
        role: "tabpanel",
        id: `tabpanel-${String(i)}`,
        "aria-labelledby": tabs[i]?.id,
        tabindex: "0",
        class: "tab-body",
      },
      content,
    ),
  );
  const select = (index: number, focus = false) => {
    tabs.forEach((tab, i) => {
      tab.setAttribute("aria-selected", String(i === index));
      tab.setAttribute("aria-controls", `tabpanel-${String(i)}`);
      tab.tabIndex = i === index ? 0 : -1;
      (panels[i] as HTMLElement).hidden = i !== index;
    });
    if (focus) tabs[index]?.focus();
  };
  tabs.forEach((tab, i) => {
    tab.addEventListener("click", () => {
      select(i);
    });
    tab.addEventListener("keydown", (event) => {
      if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
        event.preventDefault();
        select(1 - i, true);
      }
    });
  });
  select(0);
  return {
    element: h(
      "div",
      { class: "panel-tabs" },
      h(
        "div",
        {
          role: "tablist",
          "aria-label": "Preview and problems",
          class: "pill-tabs",
        },
        ...tabs,
      ),
      ...panels,
    ),
    select,
    count,
  };
}

export function editorView(
  app: AppContext,
  main: HTMLElement,
  start: { id: string } | { folderId: string },
  loading: Promise<boolean>,
): View {
  let current: Loaded = blank("folderId" in start ? start.folderId : "");
  let editor: Editor | null = null;
  let saving = false;
  let previewTimer = 0;
  let readOnly = false;
  let built = false;
  let me: Me | null = null;
  /** The form as last loaded or saved; the header says "Unsaved changes" while the form differs. */
  let savedKey = "";
  /** "Saved as version 4, 2:05 PM", or "" for a template not saved yet. */
  let lastSaved = "";

  const titleInput = h("input", {
    type: "text",
    id: "title",
    maxlength: TITLE_MAX,
    required: true,
    autocomplete: "off",
  });
  const subjectInput = h("input", {
    type: "text",
    id: "subject",
    maxlength: SUBJECT_MAX,
    autocomplete: "off",
    "aria-describedby": "subject-count",
  });
  const subjectCount = h("span", { id: "subject-count", class: "count-hint" });
  /** True while the subject input was the last field in focus, so "Insert field" targets it. */
  let subjectActive = false;
  const folderSelect = h("select", { id: "folder" });
  let tags: TagEditor = tagEditor(TAGS_MAX, TAG_MAX);
  let fields: Readonly<Record<RecipientField, ChipField>> | null = null;
  const crumbs = h("ol", { class: "crumbs" });
  const heading = h(
    "h1",
    { class: "crumb-title editor-title" },
    "New template",
  );
  const savedState = h("p", {
    class: "saved-state",
    role: "status",
    "aria-live": "polite",
  });
  const historyButton = h(
    "button",
    { type: "button", class: "ghost" },
    icon("clock"),
    "History",
  );
  const saveButton = h(
    "button",
    { type: "button", class: "primary", "aria-keyshortcuts": "Control+S" },
    "Save",
  );
  const problems = h("div", { class: "problems", role: "alert" });
  const status = h("p", {
    class: "status",
    role: "status",
    "aria-live": "polite",
  });
  const notice = h(
    "p",
    { class: "page-note read-only-note" },
    "You can use this template but not change it. To change it, ask a folder manager for edit access.",
  );
  notice.hidden = true;
  const preview = h("div", { class: "preview-body" });
  const previewRecipients = h("div");
  const previewSubject = h("p", { class: "preview-subject" });
  const asks = h("div", { class: "asks" });
  const mount = h("div", { class: "editor-mount" });
  const tabs = panelTabs(
    h("div", { class: "preview" }, previewRecipients, previewSubject, preview),
    problems,
  );
  const work = h(
    "div",
    { class: "editor-slot", "aria-busy": "true" },
    editorSkeleton(),
  );

  const recipients = (): Recipients => ({
    to: fields?.to.values() ?? [],
    cc: fields?.cc.values() ?? [],
    bcc: fields?.bcc.values() ?? [],
  });

  const policy = (): RecipientPolicy => ({
    domain: domainOf(me?.email ?? ""),
    external: me?.recipientsExternal ?? "allow",
  });

  const formKey = () =>
    JSON.stringify([
      titleInput.value,
      subjectInput.value,
      folderSelect.value,
      tags.values(),
      recipients(),
      editor?.html() ?? "",
    ]);

  const showProblems = (list: readonly ListedProblem[]) => {
    replace(problems, ...problemList(list));
    tabs.count.textContent = String(list.length);
    if (list.some((problem) => problem.kind === "error")) tabs.select(1);
  };

  const showRecipientProblems = (found: readonly RecipientProblem[]) => {
    for (const field of RECIPIENT_FIELDS)
      fields?.[field].show(found.filter((problem) => problem.field === field));
  };

  /** Header state: "Saving..." wins, then "Unsaved changes", then the last save. */
  const showSaved = () => {
    if (saving) return;
    const dirty = !readOnly && formKey() !== savedKey;
    const text = dirty ? "Unsaved changes" : lastSaved || "Not saved yet";
    savedState.classList.toggle("is-saved", !dirty && lastSaved !== "");
    replace(savedState, icon("check"), text);
  };

  const showAsks = () => {
    const uses = promptUses(editor?.html() ?? "", subjectInput.value);
    replace(
      asks,
      uses.length === 0
        ? h(
            "p",
            { class: "hint" },
            readOnly
              ? "None."
              : "Nothing yet. To add a question, choose Insert field, then Ask the user.",
          )
        : h(
            "ul",
            { class: "ask-list" },
            ...uses.map((use) =>
              h(
                "li",
                {},
                h("span", {}, use.label),
                h("span", { class: "ask-count" }, usedText(use.count)),
              ),
            ),
          ),
    );
  };

  const updatePreview = () => {
    window.clearTimeout(previewTimer);
    previewTimer = window.setTimeout(() => {
      const subject = subjectInput.value.trim();
      replace(previewRecipients, recipientBlock(recipients()));
      replace(
        previewSubject,
        subject === ""
          ? null
          : h("span", { class: "subject-label" }, "Subject:"),
        subject === "" ? null : ` ${subjectAsMe(subject, app.profile())}`,
      );
      if (editor !== null)
        preview.innerHTML = previewAsMe(editor.html(), app.profile());
      showAsks();
      showSaved();
    }, 250);
  };

  const recipientsChanged = () => {
    showRecipientProblems(validateRecipients(recipients(), policy()).problems);
    updatePreview();
  };

  const showSubjectCount = () => {
    subjectCount.textContent = `${String(subjectInput.value.length)}/${String(SUBJECT_MAX)} (optional)`;
  };

  const fillFolders = () => {
    const options = editableFolders(app.folders());
    if (
      current.folderId !== "" &&
      !options.some((option) => option.id === current.folderId)
    )
      options.unshift({
        id: current.folderId,
        label: folderPath(app.folders(), current.folderId) || "Current folder",
      });
    replace(
      folderSelect,
      ...options.map((option) =>
        h("option", { value: option.id }, option.label),
      ),
    );
    folderSelect.value =
      current.folderId !== "" ? current.folderId : (options[0]?.id ?? "");
  };

  /** Folder path as links to the library, then the title. */
  const showHeader = () => {
    const byId = new Map(app.folders().map((folder) => [folder.id, folder]));
    const chain: FolderRow[] = [];
    for (
      let folder = byId.get(current.folderId);
      folder !== undefined && !chain.includes(folder);
      folder = byId.get(folder.parentId)
    )
      chain.unshift(folder);
    replace(
      crumbs,
      ...chain.map((folder) =>
        h(
          "li",
          {},
          h(
            "button",
            {
              type: "button",
              class: "crumb",
              onclick: () => {
                app.go({ name: "library", folderId: folder.id });
              },
            },
            folder.name,
          ),
          icon("chev"),
        ),
      ),
    );
    heading.textContent = current.id === "" ? "New template" : current.title;
    historyButton.hidden = current.id === "" || readOnly;
  };

  const openPicker = (anchor: HTMLElement, onDismiss?: () => void) => {
    if (subjectActive) {
      openMenu({
        label: "Insert field",
        anchor,
        items: subjectPickerItems(subjectInput),
        returnFocus: () => {
          subjectInput.focus();
        },
      });
      return;
    }
    if (editor === null) return;
    const target = editor;
    openMenu({
      label: "Insert field",
      anchor,
      items: pickerItems(target),
      returnFocus: () => {
        target.focus();
      },
      ...(onDismiss === undefined ? {} : { onDismiss }),
    });
  };

  const insertLink = async () => {
    const href = await promptText({
      title: "Insert link",
      label: "Web address",
      hint: "Starts with https://, http://, mailto: or tel:",
      check: (value) =>
        safeHref(value)
          ? ""
          : "Use an address that starts with https://, http://, mailto: or tel:.",
    });
    if (href !== null) editor?.run(setLink(href));
    else editor?.focus();
  };

  const insertImage = async () => {
    const src = await promptText({
      title: "Insert image",
      label: "Image address (https)",
      hint: "The email links to the image; nothing is uploaded. An image wider than 600 pixels is shown 600 pixels wide.",
      check: (value) =>
        /^https:\/\/\S+$/i.test(value.trim()) ? "" : "Use an https:// address.",
    });
    if (src === null) {
      editor?.focus();
      return;
    }
    const width = imageWidth(await naturalWidth(src));
    editor?.run(
      insertNode(schema.nodes["image"].create({ src, alt: "", width })),
    );
  };

  const toolbar = createToolbar(
    {
      state: () => (editor as Editor).view.state,
      run: (command) => {
        editor?.run(command);
      },
      focus: () => {
        editor?.focus();
      },
      insertLink: () => void insertLink(),
      insertImage: () => void insertImage(),
      insertTable: () => {
        editor?.run(insertNode(newTable()));
      },
      insertRule: () => {
        editor?.run(insertNode(schema.nodes["horizontal_rule"].create()));
      },
      openPicker: (anchor) => {
        openPicker(anchor);
      },
    },
    EDITOR_ID,
  );

  const mountEditor = () => {
    editor?.destroy();
    replace(mount);
    editor = createEditor(
      mount,
      current.html,
      {
        onChange: () => {
          if (editor !== null) toolbar.update(editor.view.state);
          updatePreview();
        },
        onBraces: () => {
          openPicker(toolbar.placeholder, () => {
            editor?.run((state, dispatch) => {
              dispatch?.(state.tr.insertText("{{"));
              return true;
            });
          });
        },
        onLink: () => void insertLink(),
      },
      {
        id: EDITOR_ID,
        role: "textbox",
        "aria-multiline": "true",
        "aria-label": "Template body",
        "aria-readonly": String(readOnly),
        class: "editor",
      },
      readOnly,
    );
    toolbar.update(editor.view.state);
  };

  const detailRow = (label: string, control: HTMLElement) =>
    h(
      "div",
      { class: "panel-row" },
      h("label", { for: control.id }, label),
      h("div", { class: "panel-control" }, control),
    );

  /** Builds the work area once, when the caller's level is known. */
  const build = () => {
    built = true;
    tags = tagEditor(TAGS_MAX, TAG_MAX, updatePreview, readOnly);
    const options = {
      domain: () => domainOf(me?.email ?? ""),
      readOnly,
      onChange: recipientsChanged,
      describedBy: "rcpt-help",
    };
    fields = {
      to: recipientField("to", options),
      cc: recipientField("cc", options),
      bcc: recipientField("bcc", options),
    };
    titleInput.readOnly = readOnly;
    subjectInput.readOnly = readOnly;
    folderSelect.disabled = readOnly;
    saveButton.hidden = readOnly;
    notice.hidden = !readOnly;
    const details = h(
      "div",
      { class: "details" },
      detailRow("Title", titleInput),
      detailRow("Folder", folderSelect),
      tags.element,
      h(
        "div",
        { class: "rcpt-group" },
        fields.to.element,
        fields.cc.element,
        fields.bcc.element,
      ),
      h(
        "p",
        { class: "hint rcpt-help", id: "rcpt-help" },
        "Added to the draft when someone inserts this template. Users see every address before it is added.",
      ),
    );
    // The toolbar and its menu take focus too; only a field or the body changes the "Insert field" target.
    for (const area of [details, subjectInput, mount])
      area.addEventListener("focusin", (event) => {
        subjectActive = event.target === subjectInput;
      });
    details.addEventListener("input", updatePreview);
    details.addEventListener("change", updatePreview);
    replace(
      work,
      h(
        "div",
        { class: "editor-work" },
        h(
          "div",
          { class: "doc" },
          readOnly ? null : toolbar.element,
          h(
            "div",
            { class: "sheet editor-sheet" },
            h(
              "div",
              { class: "subject-row" },
              h("label", { for: "subject" }, "Subject"),
              subjectInput,
              subjectCount,
            ),
            mount,
          ),
        ),
        h(
          "aside",
          { class: "editor-panel", "aria-label": "Template details" },
          panelSection("Details", [details]),
          panelSection("The sender fills in", [asks]),
          panelSection("Preview", [tabs.element], true),
        ),
      ),
    );
  };

  const show = (loaded: Loaded) => {
    current = loaded;
    if (!built) build();
    titleInput.value = loaded.title;
    subjectInput.value = loaded.subject;
    showSubjectCount();
    tags.set(loaded.tags);
    for (const field of RECIPIENT_FIELDS)
      fields?.[field].set(loaded.recipients[field]);
    fillFolders();
    showHeader();
    mountEditor();
    work.setAttribute("aria-busy", "false");
    savedKey = formKey();
    lastSaved =
      loaded.id === "" ? "" : savedText(loaded.version, loaded.updatedAt);
    recipientsChanged();
    showSaved();
  };

  /** The caller's level on the template; a template the library does not list is left to the server. */
  const canEdit = (id: string) => {
    const level = app.items().find((item) => item.id === id)?.level;
    return level === undefined || atLeast(level, "edit");
  };

  /** A new template keeps its `start` route after the first save, so the saved ID wins over `start`. */
  const load = async () => {
    await loading;
    const id = current.id !== "" ? current.id : "id" in start ? start.id : "";
    if (!built) readOnly = id !== "" && !canEdit(id);
    const caller = me ?? app.api.me();
    if (id === "") {
      me = await caller;
      show(current);
      return;
    }
    const [{ item, html }, who] = await Promise.all([
      app.api.template(id),
      caller,
    ]);
    me = who;
    show(fromItem(item, html));
  };

  const conflict = (details: unknown) => {
    const info = (details ?? {}) as {
      currentVersion?: number;
      updatedBy?: string;
      updatedAt?: string;
    };
    const text = `${info.updatedBy ?? "Someone"} saved version ${String(info.currentVersion ?? "")} at ${formatTime(info.updatedAt ?? "")} while you edited.`;
    openDialog({
      title: "This template changed",
      body: h("p", {}, text),
      returnFocus: saveButton,
      actions: [
        {
          label: "Open their version",
          primary: true,
          run: () => {
            status.textContent = "Opening their version...";
            load().then(
              () => {
                status.textContent =
                  "Opened their version. Your changes were discarded.";
              },
              (error: unknown) => app.fail(error),
            );
            return true;
          },
        },
        { label: "Copy my text", run: () => void copyMine() },
        { label: "Cancel", run: () => true },
      ],
    });
  };

  const copyMine = async () => {
    const html = editor?.html() ?? "";
    const text =
      editor?.view.state.doc.textBetween(
        0,
        editor.view.state.doc.content.size,
        "\n",
        " ",
      ) ?? "";
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/html": new Blob([html], { type: "text/html" }),
          "text/plain": new Blob([text], { type: "text/plain" }),
        }),
      ]);
      status.textContent =
        "Copied your text. Open their version and paste it where needed.";
    } catch {
      status.textContent =
        "Copy failed. Select the text in the editor and press Ctrl+C.";
    }
  };

  const fail = (error: unknown) => {
    const rpc = toRpcError(error);
    if (rpc.code === ErrorCode.VALIDATION) {
      const listed = serverProblems(rpc.details);
      showProblems(
        listed.length > 0 ? listed : [{ kind: "error", message: rpc.message }],
      );
      showRecipientProblems(serverRecipientProblems(rpc.details));
      status.textContent = "Not saved. Fix the problems in the Problems tab.";
    } else if (rpc.code === ErrorCode.CONFLICT) {
      status.textContent = "Not saved: someone else saved a newer version.";
      conflict(rpc.details);
    } else {
      status.textContent = "Not saved.";
      const shown = app.fail(rpc, () => void save());
      if (shown !== null)
        showProblems([{ kind: "error", message: shown.textContent }]);
    }
  };

  const save = async () => {
    if (saving || readOnly || editor === null) return;
    const blocked = backslashProblems(editor.view.state.doc);
    if (blocked.length > 0) {
      showProblems(
        blocked.map((problem) => ({ kind: "error", message: problem.message })),
      );
      status.textContent = "Not saved. Fix the problems in the Problems tab.";
      return;
    }
    for (const field of RECIPIENT_FIELDS) fields?.[field].commit();
    saving = true;
    saveButton.disabled = true;
    saveButton.textContent = "Saving...";
    replace(savedState, "Saving...");
    savedState.classList.remove("is-saved");
    status.textContent = "";
    const html = editor.html();
    const args = {
      title: titleInput.value,
      subject: subjectInput.value,
      folderId: folderSelect.value,
      tags: tags.values(),
      html,
      ...recipients(),
    };
    const key = formKey();
    try {
      const item =
        current.id === ""
          ? await app.api.create(args)
          : await app.api.update(current.id, current.version, args);
      const isNew = current.id === "";
      current = fromItem(item, html);
      savedKey = key;
      showHeader();
      showProblems(warningsOf(html, args.subject));
      // Just saved: the time alone, from the server's clock.
      lastSaved = `Saved as version ${String(item.version)}, ${formatTime(item.updatedAt, "time")}`;
      saving = false;
      showSaved();
      if (isNew) app.replaceRoute({ name: "edit", id: item.id });
      void app.reload();
    } catch (error: unknown) {
      saving = false;
      showSaved();
      fail(error);
    } finally {
      saving = false;
      saveButton.disabled = false;
      saveButton.textContent = "Save";
    }
  };

  subjectInput.addEventListener("input", () => {
    showSubjectCount();
    updatePreview();
  });
  saveButton.addEventListener("click", () => void save());
  historyButton.addEventListener("click", () => {
    app.go({ name: "history", id: current.id });
  });
  const ctrlS = (event: KeyboardEvent) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
      event.preventDefault();
      void save();
    }
  };
  document.addEventListener("keydown", ctrlS);

  replace(
    main,
    h(
      "div",
      { class: "editor-page" },
      h(
        "div",
        { class: "editor-head" },
        h(
          "div",
          { class: "crumb-line" },
          h("nav", { "aria-label": "Folder" }, crumbs),
          heading,
        ),
        h("span", { class: "grow" }),
        savedState,
        historyButton,
        saveButton,
      ),
      notice,
      status,
      work,
    ),
  );

  load().catch((error: unknown) => {
    const shown = app.fail(error, () => {
      app.go(
        "id" in start
          ? { name: "edit", id: start.id }
          : { name: "new", folderId: current.folderId },
      );
    });
    if (shown !== null) replace(main, shown);
  });

  return {
    dispose: () => {
      document.removeEventListener("keydown", ctrlS);
      window.clearTimeout(previewTimer);
      editor?.destroy();
    },
  };
}
