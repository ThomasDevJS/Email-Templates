import { ErrorCode } from "../../shared/errors/codes";
import type { Item } from "../../shared/model/data";
import { TAGS_MAX, TAG_MAX, TITLE_MAX } from "../../shared/model/validate";
import { SUBJECT_MAX } from "../../shared/placeholders/subject";
import { scanBody } from "../../shared/placeholders/validate";
import { insertNode, newTable, setLink } from "../editor/commands";
import { pickerItems, subjectPickerItems } from "../editor/picker";
import { safeHref, schema } from "../editor/schema";
import { backslashProblems } from "../editor/serialize";
import { createEditor, type Editor } from "../editor/setup";
import { createToolbar } from "../editor/toolbar";
import { editableFolders } from "../library/model";
import { formatTime, h, replace } from "../ui/dom";
import { openDialog, promptText } from "../ui/dialog";
import { openMenu } from "../ui/menu";
import { toRpcError } from "../ui/status";
import type { AppContext, View } from "./context";
import { problemList, type ListedProblem } from "./problems";
import { previewAsMe, subjectAsMe } from "./preview";
import { tagEditor } from "./tags";

/**
 * Editor (screen 4, flow 4.2 save): title, subject, folder, tags, toolbar, ProseMirror body, preview as me,
 * problems (role alert) and status (role status). Save by button or Ctrl+S; disabled while saving. A stale base
 * version opens the conflict dialog with three choices; nothing is overwritten silently. The subject is a plain
 * input: tokens are typed as text, and the Placeholder menu inserts token text there while it has focus.
 */
interface Loaded {
  readonly id: string;
  readonly version: number;
  readonly title: string;
  readonly subject: string;
  readonly folderId: string;
  readonly tags: readonly string[];
  readonly html: string;
}

const EDITOR_ID = "editor-body";

function blank(folderId: string): Loaded {
  return {
    id: "",
    version: 0,
    title: "",
    subject: "",
    folderId,
    tags: [],
    html: "",
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
    html,
  };
}

/** Problems in the subject name the field (wireframe 04): "Subject: Unknown placeholder ...". */
function fieldMessage(problem: { message?: unknown; field?: unknown }) {
  const message = String(problem.message);
  return problem.field === "subject" ? `Subject: ${message}` : message;
}

function serverProblems(details: unknown): ListedProblem[] {
  const problems = (details as { problems?: unknown } | undefined)?.problems;
  if (!Array.isArray(problems)) return [];
  return problems.map((problem: { message?: unknown; field?: unknown }) => ({
    kind: "error",
    message: fieldMessage(problem),
  }));
}

function warningsOf(html: string, subject: string): ListedProblem[] {
  return scanBody(html, [], subject.trim()).warnings.map((warning) => ({
    kind: "warning",
    message: fieldMessage(warning),
  }));
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
  const subjectCount = h("span", { id: "subject-count", class: "hint" });
  /** True while the subject input was the last field in focus, so the Placeholder menu targets it. */
  let subjectActive = false;
  const folderSelect = h("select", { id: "folder" });
  const tags = tagEditor(TAGS_MAX, TAG_MAX);
  const heading = h("h1", { class: "editor-title" }, "New template");
  const versionText = h("span", { class: "version" });
  const historyButton = h(
    "button",
    { type: "button", class: "link" },
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
  const preview = h("div", { class: "preview-body" });
  const previewSubject = h("p", { class: "preview-subject" });
  const mount = h("div", { class: "editor-mount" });
  const body = h(
    "div",
    { class: "editor-area", "aria-busy": "true" },
    h("div", { class: "skeleton-block", "aria-hidden": "true" }),
  );

  const showProblems = (list: readonly ListedProblem[]) => {
    replace(problems, ...problemList(list));
  };

  const updatePreview = () => {
    window.clearTimeout(previewTimer);
    previewTimer = window.setTimeout(() => {
      const subject = subjectInput.value.trim();
      previewSubject.textContent =
        subject === "" ? "" : `Subject: ${subjectAsMe(subject, app.profile())}`;
      if (editor !== null)
        preview.innerHTML = previewAsMe(editor.html(), app.profile());
    }, 250);
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
      options.unshift({ id: current.folderId, label: "Current folder" });
    replace(
      folderSelect,
      ...options.map((option) =>
        h("option", { value: option.id }, option.label),
      ),
    );
    folderSelect.value =
      current.folderId !== "" ? current.folderId : (options[0]?.id ?? "");
  };

  const showVersion = () => {
    heading.textContent = current.id === "" ? "New template" : current.title;
    versionText.textContent =
      current.id === "" ? "" : `Version ${String(current.version)}`;
    historyButton.hidden = current.id === "";
  };

  const openPicker = (anchor: HTMLElement, onDismiss?: () => void) => {
    if (subjectActive) {
      openMenu({
        label: "Placeholders",
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
      label: "Placeholders",
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
      title: "Link",
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
      title: "Image",
      label: "Image address (https)",
      hint: "Images are linked, not uploaded. Width is set to 600 pixels or less.",
      check: (value) =>
        /^https:\/\/\S+$/i.test(value.trim()) ? "" : "Use an https:// address.",
    });
    if (src !== null)
      editor?.run(
        insertNode(
          schema.nodes["image"].create({ src, alt: "", width: "600" }),
        ),
      );
    else editor?.focus();
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
          openPicker(toolbar.element.lastElementChild as HTMLElement, () => {
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
        class: "editor",
      },
    );
    toolbar.update(editor.view.state);
    updatePreview();
  };

  const show = (loaded: Loaded) => {
    current = loaded;
    titleInput.value = loaded.title;
    subjectInput.value = loaded.subject;
    showSubjectCount();
    tags.set(loaded.tags);
    fillFolders();
    showVersion();
    mountEditor();
    body.setAttribute("aria-busy", "false");
    replace(body, toolbar.element, mount);
  };

  /** A new template keeps its `start` route after the first save, so the saved ID wins over `start`. */
  const load = async () => {
    await loading;
    const id = current.id !== "" ? current.id : "id" in start ? start.id : "";
    if (id === "") {
      show(current);
      return;
    }
    const { item, html } = await app.api.template(id);
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
            status.textContent = "Loading the latest version...";
            load().then(
              () => {
                status.textContent =
                  "Loaded the latest version. Your changes were discarded.";
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
        "Your text is on the clipboard. Open their version and paste it where needed.";
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
      status.textContent = "Not saved. Fix the problems listed above.";
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
    if (saving || editor === null) return;
    const blocked = backslashProblems(editor.view.state.doc);
    if (blocked.length > 0) {
      showProblems(
        blocked.map((problem) => ({ kind: "error", message: problem.message })),
      );
      status.textContent = "Not saved. Fix the problems listed above.";
      return;
    }
    saving = true;
    saveButton.disabled = true;
    saveButton.textContent = "Saving...";
    status.textContent = "Saving...";
    const html = editor.html();
    const args = {
      title: titleInput.value,
      subject: subjectInput.value,
      folderId: folderSelect.value,
      tags: tags.values(),
      html,
    };
    try {
      const item =
        current.id === ""
          ? await app.api.create(args)
          : await app.api.update(current.id, current.version, args);
      const isNew = current.id === "";
      current = fromItem(item, html);
      showVersion();
      showProblems(warningsOf(html, args.subject));
      status.textContent = `Saved as version ${String(item.version)}, ${formatTime(item.updatedAt).slice(11)}`;
      if (isNew) app.replaceRoute({ name: "edit", id: item.id });
      void app.reload();
    } catch (error: unknown) {
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
  const fields = h(
    "div",
    { class: "editor-fields" },
    h(
      "div",
      { class: "field" },
      h("label", { for: "title" }, "Title"),
      titleInput,
    ),
    h(
      "div",
      { class: "field" },
      h("label", { for: "subject" }, "Subject"),
      subjectInput,
      subjectCount,
    ),
    h(
      "div",
      { class: "field" },
      h("label", { for: "folder" }, "Folder"),
      folderSelect,
    ),
    tags.element,
  );
  // The toolbar and its menu take focus too; only a field or the body changes the Placeholder target.
  for (const area of [fields, mount])
    area.addEventListener("focusin", (event) => {
      subjectActive = event.target === subjectInput;
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
        { class: "editor-header" },
        h(
          "button",
          {
            type: "button",
            class: "link",
            onclick: () => {
              app.go({ name: "library", folderId: current.folderId });
            },
          },
          "‹ Library",
        ),
        heading,
        versionText,
        historyButton,
        saveButton,
      ),
      fields,
      h(
        "div",
        { class: "editor-columns" },
        body,
        h(
          "aside",
          { class: "preview", "aria-labelledby": "preview-heading" },
          h("h2", { id: "preview-heading" }, "Preview as me"),
          previewSubject,
          preview,
        ),
      ),
      problems,
      status,
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
