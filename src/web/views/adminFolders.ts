import type { Level, PrincipalType } from "../../shared/model/data";
import { FOLDER_NAME_MAX } from "../../shared/model/validate";
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
import { skeletonRows } from "../ui/status";
import type { AdminData } from "./admin";
import type { AppContext, View } from "./context";
import { createFolderTree } from "./tree";

/**
 * Tab "Folders and grants" (wireframe 06): folder tree, folder actions (new top-level folder for admins, new
 * subfolder, rename, move, delete with confirmation) and the effective access table with add and remove grant.
 * Private folders (D11, D18) show their owner and take no grant, move or delete. Every write shows a busy status at
 * once; afterwards the folders or grants reload from the server, so a concurrent change shows up.
 */
interface Outcome {
  readonly text: string;
  readonly select: string;
}

const TYPES: readonly [PrincipalType, string][] = [
  ["group", "Group"],
  ["user", "User"],
  ["domain", "Domain"],
  ["ou", "OU (inactive in v1)"],
];
const LEVELS: readonly Level[] = ["use", "edit", "manage"];

function selectOf(id: string, options: readonly [string, string][]) {
  return h(
    "select",
    { id },
    ...options.map(([value, label]) => h("option", { value }, label)),
  );
}

export function foldersTab(
  app: AppContext,
  panel: HTMLElement,
  initial: AdminData,
): View {
  let data = initial;
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
    tree.render(data.folders, id);
    drawDetail();
  }, "All folders");

  const folderOf = (id: string): FolderRow | undefined =>
    data.folders.find((folder) => folder.id === id);
  const focusHeading = () => {
    detail.querySelector<HTMLElement>("#folder-heading")?.focus();
  };

  const refresh = async (select: string) => {
    data = await app.api.adminFolders();
    selected = folderOf(select) === undefined ? "" : select;
    tree.render(data.folders, selected);
    drawDetail();
  };

  /** Busy text at once, the folder write, then the folder list again; a failure shows its text and reloads. */
  const write = (pending: string, work: () => Promise<Outcome>) => {
    status.textContent = pending;
    work()
      .then(async (outcome) => {
        await refresh(outcome.select);
        status.textContent = outcome.text;
      })
      .catch(async (error: unknown) => {
        status.textContent = app.fail(error)?.textContent ?? "";
        await refresh(selected).catch(() => undefined);
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
      status.textContent = "There is no folder you manage to move it into.";
      return;
    }
    const id = uid("move-target");
    const select = selectOf(
      id,
      options.map((option) => [option.id, option.label]),
    );
    openDialog({
      title: "Move folder",
      body: h(
        "div",
        { class: "field" },
        h("label", { for: id }, `Move "${folder.name}" into`),
        select,
      ),
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
        `Delete the folder "${folder.name}"? Only an empty folder can be deleted. Its grants stop applying.`,
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
        status.textContent = text;
        loadGrants(folder.id);
      })
      .catch((error: unknown) => {
        status.textContent = app.fail(error)?.textContent ?? "";
        loadGrants(folder.id);
      });
  };

  const removeButton = (folder: FolderRow, grant: GrantRow, label: string) =>
    h(
      "button",
      {
        type: "button",
        "aria-label": `Remove grant for ${label}`,
        onclick: () => {
          grantWrite(folder, "Removing grant...", async () => {
            await app.api.removeGrant(grant.id);
            return `Removed the grant for ${label}.`;
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
          "Only admins can see this folder. Add a grant to share it.",
        ),
      );
      return;
    }
    replace(
      access,
      h(
        "table",
        { class: "admin-table", "aria-labelledby": "access-heading" },
        h(
          "thead",
          {},
          h(
            "tr",
            {},
            ...["Principal", "Level", "Source", "Actions"].map((label) =>
              h("th", { scope: "col" }, label),
            ),
          ),
        ),
        h(
          "tbody",
          {},
          ...accessRows(grants).map((row) =>
            h(
              "tr",
              {},
              h(
                "td",
                {},
                row.principal,
                row.note === "" ? null : h("p", { class: "hint" }, row.note),
              ),
              h("td", {}, row.grant.level),
              h("td", {}, row.source),
              h(
                "td",
                {},
                row.grant.inherited
                  ? null
                  : removeButton(folder, row.grant, row.principal),
              ),
            ),
          ),
        ),
      ),
    );
  };

  const loadGrants = (folderId: string) => {
    grantTicket += 1;
    const ticket = grantTicket;
    access.setAttribute("aria-busy", "true");
    replace(access, ...skeletonRows(3));
    app.api.grants(folderId).then(
      ({ grants }) => {
        const folder = folderOf(folderId);
        if (ticket === grantTicket && folder !== undefined)
          drawGrants(folder, grants);
      },
      (error: unknown) => {
        if (ticket !== grantTicket) return;
        access.setAttribute("aria-busy", "false");
        replace(
          access,
          h("p", { class: "error" }, app.fail(error)?.textContent ?? ""),
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
    const key = h("input", {
      type: "text",
      id: keyId,
      autocomplete: "off",
      "aria-describedby": `${keyId}-hint`,
    });
    const level = selectOf(
      levelId,
      LEVELS.map((value) => [value, value]),
    );
    const error = h("p", { class: "error", role: "alert" });
    const showHint = () => {
      hint.textContent = principalHint(type.value as PrincipalType);
    };
    type.addEventListener("change", showHint);
    showHint();
    const form = h(
      "form",
      { class: "grant-form", "aria-labelledby": "grant-heading" },
      h("h3", { id: "grant-heading" }, "Add grant"),
      h(
        "div",
        { class: "grant-fields" },
        h("div", { class: "field" }, h("label", { for: typeId }, "Type"), type),
        h(
          "div",
          { class: "field" },
          h("label", { for: keyId }, "Principal"),
          key,
          hint,
        ),
        h(
          "div",
          { class: "field" },
          h("label", { for: levelId }, "Level"),
          level,
        ),
      ),
      h("button", { type: "submit", class: "primary" }, "Add grant"),
      error,
    );
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const principalKey = key.value.trim();
      error.textContent = principalKey === "" ? "Enter a principal." : "";
      if (principalKey === "") {
        key.focus();
        return;
      }
      const principalType = type.value as PrincipalType;
      const chosen = level.value as Level;
      grantWrite(folder, "Adding grant...", async () => {
        await app.api.addGrant({
          folderId: folder.id,
          principalType,
          principalKey,
          level: chosen,
        });
        key.value = "";
        return `Added ${principalType} ${principalKey} with level ${chosen}.`;
      });
    });
    return form;
  };

  const actionButton = (label: string, run: () => void) =>
    h("button", { type: "button", onclick: run }, label);

  const folderActions = (folder: FolderRow): HTMLElement => {
    const isPrivate = folder.kind === "private";
    return h(
      "div",
      { class: "list-actions" },
      isPrivate
        ? null
        : actionButton("+ Subfolder", () => {
            createFolder(folder.id);
          }),
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
        { class: "list-header" },
        h(
          "h3",
          { id: "folder-heading", tabindex: "-1" },
          folderPath(data.folders, folder.id),
        ),
        folderActions(folder),
      ),
      isPrivate
        ? h(
            "p",
            { class: "hint" },
            `Private folder of ${folder.ownerEmail}. Private folders cannot be shared, moved or deleted.`,
          )
        : null,
      h("h3", { id: "access-heading" }, "Effective access"),
      access,
      isPrivate ? null : grantForm(folder),
    );
    loadGrants(folder.id);
  };

  const drawRoot = () => {
    replace(
      detail,
      h("h3", { id: "folder-heading", tabindex: "-1" }, "All folders"),
      h(
        "p",
        { class: "hint" },
        data.isAdmin
          ? "Select a folder to see who has access, or create a top-level folder."
          : "Select a folder you manage to see who has access.",
      ),
      data.isAdmin
        ? h(
            "button",
            {
              type: "button",
              class: "primary",
              onclick: () => {
                createFolder("");
              },
            },
            "+ Top-level folder",
          )
        : null,
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
