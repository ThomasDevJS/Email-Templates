import type { Level, PrincipalType } from "../../shared/model/data";
import {
  FOLDER_NAME_MAX,
  PRINCIPAL_KEY_MAX,
} from "../../shared/model/validate";
import {
  accessRows,
  folderMoveTargets,
  folderNameProblem,
  principalHint,
} from "../admin/model";
import { folderPath } from "../library/model";
import type { FolderRow, GrantRow } from "../rpc/api";
import { openDialog, promptText } from "../ui/dialog";
import { h, replace, uid } from "../ui/dom";
import { icon, type IconName } from "../ui/icons";
import { lineText, skeletonRows } from "../ui/status";
import type { AdminData, AdminFolders } from "./admin";
import { adminTable, tableRow, toneTag, type Column } from "./adminTable";
import type { AppContext, View } from "./context";
import { createFolderTree } from "./tree";

/**
 * Tab "Folders and access" (wireframe 06): folder tree, folder actions (new top-level folder for admins, new
 * subfolder, rename, move, delete with confirmation) and the "Who has access" table with give and remove access.
 * Private folders (D11, D18) show their owner and take no grant, move or delete. Every write shows a busy status at
 * once; afterwards the folders or grants reload from the server, so a concurrent change shows up.
 */
interface Outcome {
  readonly text: string;
  readonly select: string;
  /** The folder moved: show it under its new parent. */
  readonly moved?: true;
}

const TYPES: readonly [PrincipalType, string][] = [
  ["group", "Group"],
  ["user", "User"],
  ["domain", "Domain"],
  ["ou", "Org unit (not active yet)"],
];
const LEVELS: readonly [Level, string][] = [
  ["use", "Can use"],
  ["edit", "Can edit"],
  ["manage", "Can manage"],
];
/** What each access level allows (spec 5.1 role matrix), shown under the Give access form. */
export const LEVEL_HELP: readonly string[] = [
  "Can use: see the templates in this folder and insert them in Gmail.",
  "Can edit: also create, change, move and delete templates, and see their history.",
  "Can manage: also add subfolders, rename, move or delete the folder, and give access.",
];
const TYPE_ICONS: Readonly<Record<PrincipalType, IconName>> = {
  group: "group",
  user: "person",
  domain: "domain",
  ou: "org",
};
const ACCESS_COLUMNS: readonly Column[] = [
  { label: "Who" },
  { label: "Access" },
  { label: "Set on" },
  { label: "Actions", hidden: true },
];

const levelWord = (level: Level): string =>
  LEVELS.find(([value]) => value === level)?.[1] ?? level;

function selectOf(id: string, options: readonly [string, string][]) {
  return h(
    "select",
    { id },
    ...options.map(([value, label]) => h("option", { value }, label)),
  );
}

function labelled(id: string, label: string, ...control: HTMLElement[]) {
  return h(
    "div",
    { class: "field" },
    h("label", { for: id }, label),
    ...control,
  );
}

export function foldersTab(
  app: AppContext,
  panel: HTMLElement,
  folders: AdminFolders,
): View {
  let data = folders.current();
  let selected = "";
  let grantTicket = 0;
  const status = h("p", {
    class: "status",
    role: "status",
    "aria-live": "polite",
  });
  const detail = h("section", {
    class: "folder-detail",
    "aria-labelledby": "folder-heading",
  });
  const tree = createFolderTree((id) => {
    selected = id;
    tree.render(data.folders, id, undefined, true);
    drawDetail();
  }, "All folders");

  const folderOf = (id: string): FolderRow | undefined =>
    data.folders.find((folder) => folder.id === id);
  const focusHeading = () => {
    detail.querySelector<HTMLElement>("#folder-heading")?.focus();
  };

  const redraw = async (
    list: Promise<AdminData>,
    select: string,
    moved = false,
  ) => {
    data = await list;
    const before = selected;
    selected = folderOf(select) === undefined ? "" : select;
    // A new or moved selection shows; a rename keeps the tree as the user left it.
    tree.render(
      data.folders,
      selected,
      undefined,
      moved || selected !== before,
    );
    drawDetail();
  };

  /** Busy text at once, the folder write, then the shared folder list again; a failure shows its text and reloads. */
  const write = (pending: string, work: () => Promise<Outcome>) => {
    status.textContent = pending;
    const running = work();
    const listed = folders.refresh(running);
    running
      .then(async (outcome) => {
        app.foldersChanged();
        await redraw(listed, outcome.select, outcome.moved === true);
        status.textContent = outcome.text;
      })
      .catch(async (error: unknown) => {
        status.textContent = lineText(error, app.fail(error));
        await redraw(listed, selected).catch(() => undefined);
      })
      .finally(focusHeading);
  };

  const createFolder = (parentId: string) => {
    void promptText({
      title: parentId === "" ? "New top-level folder" : "New subfolder",
      label: "Folder name",
      maxLength: FOLDER_NAME_MAX,
      check: folderNameProblem,
    }).then((name) => {
      if (name === null) return;
      write("Creating folder...", async () => {
        const folder = await app.api.createFolder(parentId, name);
        return { text: `Created folder "${folder.name}".`, select: folder.id };
      });
    });
  };

  const renameFolder = (folder: FolderRow) => {
    void promptText({
      title: "Rename folder",
      label: "Folder name",
      value: folder.name,
      maxLength: FOLDER_NAME_MAX,
      check: folderNameProblem,
    }).then((name) => {
      if (name === null) return;
      write("Renaming folder...", async () => {
        const renamed = await app.api.renameFolder(folder, name);
        return { text: `Renamed to "${renamed.name}".`, select: folder.id };
      });
    });
  };

  const moveFolder = (folder: FolderRow) => {
    const options = folderMoveTargets(data.folders, folder, data.isAdmin);
    if (options.length === 0) {
      status.textContent =
        "Not moved. A folder can move only into another folder you manage.";
      return;
    }
    const id = uid("move-target");
    const select = selectOf(
      id,
      options.map((option) => [option.id, option.label]),
    );
    openDialog({
      title: "Move folder",
      body: labelled(id, `Move "${folder.name}" into`, select),
      actions: [
        {
          label: "Move",
          primary: true,
          run: () => {
            const target = select.value;
            const label = select.selectedOptions[0]?.textContent ?? "";
            write("Moving folder...", async () => {
              await app.api.moveFolder(folder, target);
              return {
                text: `Moved "${folder.name}" into ${label}.`,
                select: folder.id,
                moved: true,
              };
            });
            return true;
          },
        },
        { label: "Cancel", run: () => true },
      ],
    });
  };

  const deleteFolder = (folder: FolderRow) => {
    openDialog({
      title: "Delete folder",
      body: h(
        "p",
        {},
        `Delete the folder "${folder.name}"? Only an empty folder can be deleted. Access given on this folder ends.`,
      ),
      actions: [
        {
          label: "Delete",
          primary: true,
          run: () => {
            write("Deleting folder...", async () => {
              await app.api.deleteFolder(folder);
              return {
                text: `Deleted folder "${folder.name}".`,
                select: folder.parentId,
              };
            });
            return true;
          },
        },
        // Cancel gets the first focus, as in the library Delete dialog.
        { label: "Cancel", run: () => true, autofocus: true },
      ],
    });
  };

  const access = h("div", {
    class: "list",
    "aria-labelledby": "access-heading",
    role: "region",
  });

  /** Grant write: busy text at once, then the grants of the folder again. Form values stay on failure. */
  const grantWrite = (
    folder: FolderRow,
    pending: string,
    work: () => Promise<string>,
  ) => {
    status.textContent = pending;
    work()
      .then((text) => {
        folders.grants.delete(folder.id);
        // A grant can change the caller's own levels: the library loads the folders again on its next view.
        app.foldersChanged();
        status.textContent = text;
        loadGrants(folder.id);
      })
      .catch((error: unknown) => {
        status.textContent = lineText(error, app.fail(error));
        loadGrants(folder.id);
      });
  };

  const removeButton = (folder: FolderRow, grant: GrantRow, label: string) =>
    h(
      "button",
      {
        type: "button",
        class: "ghost",
        "aria-label": `Remove access for ${label}`,
        onclick: () => {
          grantWrite(folder, "Removing access...", async () => {
            await app.api.removeGrant(grant.id);
            return `Removed access for ${label}.`;
          });
        },
      },
      "Remove",
    );

  const drawGrants = (folder: FolderRow, grants: readonly GrantRow[]) => {
    access.setAttribute("aria-busy", "false");
    if (grants.length === 0) {
      replace(
        access,
        h(
          "p",
          { class: "empty", role: "status" },
          "Only admins can see this folder. Give access to share it.",
        ),
      );
      return;
    }
    replace(
      access,
      adminTable(
        ACCESS_COLUMNS,
        accessRows(grants).map((row) =>
          tableRow(ACCESS_COLUMNS, [
            h(
              "span",
              { class: "principal" },
              icon(TYPE_ICONS[row.grant.principalType]),
              h(
                "span",
                {},
                h("span", { class: "sr-only" }, `${row.typeLabel} `),
                row.grant.principalKey,
                row.note === "" ? null : h("p", { class: "hint" }, row.note),
              ),
            ),
            toneTag(levelWord(row.grant.level), "plain"),
            h("span", { class: "meta" }, row.source),
            row.grant.inherited
              ? null
              : removeButton(folder, row.grant, row.principal),
          ]),
        ),
        { labelledBy: "access-heading" },
      ),
    );
  };

  /**
   * A folder seen before in this Admin page shows its access at once and reads it again in the background (D37);
   * the fresh answer redraws only when it differs.
   */
  const loadGrants = (folderId: string) => {
    grantTicket += 1;
    const ticket = grantTicket;
    const known = folders.grants.get(folderId);
    const folderNow = folderOf(folderId);
    if (known !== undefined && folderNow !== undefined)
      drawGrants(folderNow, known);
    else {
      access.setAttribute("aria-busy", "true");
      replace(access, ...skeletonRows(3));
    }
    (known === undefined ? app.api : app.background).grants(folderId).then(
      ({ grants }) => {
        const folder = folderOf(folderId);
        folders.grants.set(folderId, grants);
        if (
          ticket === grantTicket &&
          folder !== undefined &&
          JSON.stringify(grants) !== JSON.stringify(known)
        )
          drawGrants(folder, grants);
      },
      (error: unknown) => {
        if (ticket !== grantTicket) return;
        access.setAttribute("aria-busy", "false");
        replace(
          access,
          h("p", { class: "error" }, lineText(error, app.fail(error))),
        );
      },
    );
  };

  const grantForm = (folder: FolderRow) => {
    const typeId = uid("grant-type");
    const keyId = uid("grant-key");
    const levelId = uid("grant-level");
    const type = selectOf(typeId, TYPES);
    const hint = h("p", { class: "hint", id: `${keyId}-hint` });
    const error = h("p", {
      class: "error",
      id: `${keyId}-error`,
      role: "alert",
    });
    const key = h("input", {
      type: "text",
      id: keyId,
      autocomplete: "off",
      maxlength: PRINCIPAL_KEY_MAX,
      "aria-describedby": `${keyId}-hint ${keyId}-error`,
    });
    const level = selectOf(levelId, LEVELS);
    level.setAttribute("aria-describedby", `${levelId}-help`);
    const showHint = () => {
      hint.textContent = principalHint(type.value as PrincipalType);
    };
    type.addEventListener("change", showHint);
    showHint();
    const form = h(
      "form",
      { class: "grant-form", "aria-labelledby": "grant-heading" },
      h("h2", { id: "grant-heading" }, "Give access"),
      h(
        "div",
        { class: "form-row" },
        labelled(typeId, "Type", type),
        h(
          "div",
          { class: "field grow" },
          h("label", { for: keyId }, "Give access to"),
          key,
          error,
          hint,
        ),
        labelled(levelId, "Access", level),
        h(
          "div",
          { class: "field" },
          h("span", { class: "label-gap", "aria-hidden": "true" }),
          h("button", { type: "submit", class: "primary" }, "Give access"),
        ),
      ),
      h(
        "ul",
        { class: "hint", id: `${levelId}-help` },
        ...LEVEL_HELP.map((line) => h("li", {}, line)),
      ),
    );
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const principalKey = key.value.trim();
      const missing = principalKey === "";
      error.textContent = missing ? "Enter a group, user or domain." : "";
      if (missing) {
        key.setAttribute("aria-invalid", "true");
        key.focus();
        return;
      }
      key.removeAttribute("aria-invalid");
      const principalType = type.value as PrincipalType;
      const chosen = level.value as Level;
      grantWrite(folder, "Giving access...", async () => {
        await app.api.addGrant({
          folderId: folder.id,
          principalType,
          principalKey,
          level: chosen,
        });
        key.value = "";
        return `Gave access to ${principalKey}: ${levelWord(chosen)}.`;
      });
    });
    return form;
  };

  const actionButton = (label: string, run: () => void, name?: IconName) =>
    h(
      "button",
      { type: "button", onclick: run },
      name === undefined ? null : icon(name),
      label,
    );

  const folderActions = (folder: FolderRow): HTMLElement => {
    const isPrivate = folder.kind === "private";
    return h(
      "div",
      { class: "list-actions folder-actions" },
      isPrivate
        ? null
        : actionButton(
            "New subfolder",
            () => {
              createFolder(folder.id);
            },
            "plus",
          ),
      actionButton("Rename...", () => {
        renameFolder(folder);
      }),
      isPrivate
        ? null
        : actionButton("Move...", () => {
            moveFolder(folder);
          }),
      isPrivate
        ? null
        : actionButton("Delete...", () => {
            deleteFolder(folder);
          }),
    );
  };

  const drawFolder = (folder: FolderRow) => {
    const isPrivate = folder.kind === "private";
    replace(
      detail,
      h(
        "div",
        { class: "detail-head" },
        h(
          "h2",
          { id: "folder-heading", tabindex: "-1" },
          folderPath(data.folders, folder.id),
        ),
        folderActions(folder),
      ),
      isPrivate
        ? h(
            "p",
            { class: "hint" },
            `Personal folder of ${folder.ownerEmail}. Personal folders cannot be shared, moved or deleted.`,
          )
        : null,
      h("h2", { id: "access-heading" }, "Who has access"),
      access,
      isPrivate ? null : grantForm(folder),
    );
    loadGrants(folder.id);
  };

  const drawRoot = () => {
    replace(
      detail,
      h(
        "div",
        { class: "detail-head" },
        h("h2", { id: "folder-heading", tabindex: "-1" }, "All folders"),
      ),
      h(
        "p",
        { class: "hint" },
        data.isAdmin
          ? "Select a folder to see who has access, or create a top-level folder."
          : "Select a folder you manage to see who has access.",
      ),
    );
  };

  const drawDetail = () => {
    const folder = folderOf(selected);
    if (folder === undefined) drawRoot();
    else drawFolder(folder);
  };

  replace(
    panel,
    h(
      "div",
      { class: "admin-folders" },
      h(
        "nav",
        { class: "folders", "aria-label": "Folders to manage" },
        tree.element,
        data.isAdmin
          ? h(
              "button",
              {
                type: "button",
                class: "ghost new-top",
                onclick: () => {
                  createFolder("");
                },
              },
              icon("plus"),
              "New top-level folder",
            )
          : null,
      ),
      detail,
    ),
    status,
  );
  tree.render(data.folders, selected);
  drawDetail();
  return {
    dispose: () => {
      grantTicket += 1;
    },
  };
}
