import { TRASH_DAYS } from "../../shared/model/validate";
import { purgeText } from "../admin/actions";
import { daysLeft, displayPath } from "../admin/model";
import { editableFolders, folderPath } from "../library/model";
import type { TrashRow } from "../rpc/api";

import { openDialog } from "../ui/dialog";
import { formatTime, h, replace, uid } from "../ui/dom";
import { person } from "../ui/person";
import { lineText, skeletonRows } from "../ui/status";
import type { AppContext, View } from "./context";
import { pathBlock, titleBlock } from "./grid";

/**
 * Trash (wireframe 07 H): soft-deleted templates the caller may edit, with deleted time and days left. Restore
 * puts a template back in its folder; when that folder is gone or the caller lacks edit there, a dialog asks for
 * a target folder. Admins get "Empty trash now" with a confirmation. Every write shows a busy status at once.
 */
export function trashView(
  app: AppContext,
  main: HTMLElement,
  loading: Promise<boolean>,
): View {
  const heading = h("h1", { id: "trash-heading", tabindex: "-1" }, "Trash");
  const count = h("span", { class: "count" });
  const actions = h("div", { class: "list-actions" });
  const status = h("p", {
    class: "status",
    role: "status",
    "aria-live": "polite",
  });
  const list = h(
    "div",
    {
      class: "list",
      role: "region",
      "aria-labelledby": "trash-heading",
      "aria-busy": "true",
    },
    ...skeletonRows(),
  );
  let rows: readonly TrashRow[] = [];

  /** Focus after a change: the next row's Restore button, else the heading. */
  const focusRow = (index: number) => {
    const buttons = list.querySelectorAll<HTMLButtonElement>("button.restore");
    (buttons[Math.min(index, buttons.length - 1)] ?? heading).focus();
  };

  const restoreTo = (row: TrashRow, index: number, folderId: string) => {
    status.textContent = `Restoring "${row.title}"...`;
    app.api
      .restoreFromTrash(row.id, folderId)
      .then(async (item) => {
        await app.reload();
        await load();
        status.textContent = `Restored "${row.title}" to ${folderPath(app.folders(), item.folderId)}.`;
        focusRow(index);
      })
      .catch(async (error: unknown) => {
        status.textContent = lineText(error, app.fail(error));
        await load();
        focusRow(index);
      });
  };

  const pickFolder = (row: TrashRow, index: number) => {
    const options = editableFolders(app.folders());
    if (options.length === 0) {
      status.textContent =
        "You can edit no folder to restore into. Ask a folder manager.";
      return;
    }
    const id = uid("restore-folder");
    const select = h(
      "select",
      { id },
      ...options.map((option) =>
        h("option", { value: option.id }, option.label),
      ),
    );
    openDialog({
      title: "Restore template",
      body: h(
        "div",
        { class: "field" },
        h(
          "p",
          {},
          row.folderLive
            ? `You cannot edit ${displayPath(row.folderPath)} any more.`
            : `The folder ${displayPath(row.folderPath)} was deleted.`,
        ),
        h("label", { for: id }, `Restore "${row.title}" to`),
        select,
      ),
      actions: [
        {
          label: "Restore",
          primary: true,
          run: () => {
            restoreTo(row, index, select.value);
            return true;
          },
        },
        { label: "Cancel", run: () => true },
      ],
    });
  };

  const restore = (row: TrashRow, index: number) => {
    const inPlace =
      row.folderLive &&
      editableFolders(app.folders()).some(
        (option) => option.id === row.folderId,
      );
    if (inPlace) restoreTo(row, index, "");
    else pickFolder(row, index);
  };

  const purge = () => {
    const before = rows.length;
    openDialog({
      title: "Empty trash",
      body: h(
        "p",
        {},
        `Remove all ${String(before)} templates in the trash for good? Deleted folders go too. This cannot be undone.`,
      ),
      actions: [
        {
          label: "Empty trash",
          destructive: true,
          run: () => {
            status.textContent = "Emptying the trash...";
            app.api
              .purgeTrash()
              .then(async ({ purged, itemsPending }) => {
                await load();
                status.textContent = `${purgeText(before, rows.length, purged)}${
                  itemsPending > 0
                    ? ` The nightly job deletes the stored versions of ${String(itemsPending)} of them.`
                    : ""
                }`;
                heading.focus();
              })
              .catch(async (error: unknown) => {
                status.textContent = lineText(error, app.fail(error));
                await load();
              });
            return true;
          },
        },
        { label: "Cancel", run: () => true, autofocus: true },
      ],
    });
  };

  const table = () =>
    h(
      "table",
      { class: "trash-table", "aria-labelledby": "trash-heading" },
      h(
        "thead",
        {},
        h(
          "tr",
          {},
          ...["Template", "Folder", "Deleted", "By", "Days left"].map((label) =>
            h("th", { scope: "col" }, label),
          ),
          h("th", { scope: "col" }, h("span", { class: "sr-only" }, "Actions")),
        ),
      ),
      h(
        "tbody",
        {},
        ...rows.map((row, index) =>
          h(
            "tr",
            {},
            h("td", {}, titleBlock(row)),
            h("td", {}, pathBlock(displayPath(row.folderPath))),
            h("td", {}, formatTime(row.deletedAt)),
            h("td", {}, person(row.deletedBy)),
            h("td", {}, String(daysLeft(row.deletedAt, Date.now()))),
            h(
              "td",
              { class: "act" },
              h(
                "button",
                {
                  type: "button",
                  class: "restore",
                  "aria-label": `Restore ${row.title}`,
                  onclick: () => {
                    restore(row, index);
                  },
                },
                "Restore",
              ),
            ),
          ),
        ),
      ),
    );

  const draw = (canPurge: boolean) => {
    list.setAttribute("aria-busy", "false");
    count.textContent = String(rows.length);
    replace(
      actions,
      canPurge && rows.length > 0
        ? h("button", { type: "button", onclick: purge }, "Empty trash now...")
        : null,
    );
    replace(
      list,
      rows.length === 0
        ? h(
            "p",
            { class: "empty", role: "status" },
            `Trash is empty. Deleted templates stay here for ${String(TRASH_DAYS)} days.`,
          )
        : table(),
    );
  };

  const load = (): Promise<void> =>
    app.api.trash().then(
      (data) => {
        rows = data.items;
        draw(data.canPurge);
      },
      (error: unknown) => {
        list.setAttribute("aria-busy", "false");
        replace(
          list,
          app.fail(error, () => void load()) ??
            h(
              "p",
              { class: "empty" },
              "The trash could not be loaded. Use Retry in the message, or reload the page.",
            ),
        );
      },
    );

  replace(
    main,
    h(
      "section",
      { class: "page trash", "aria-labelledby": "trash-heading" },
      h(
        "div",
        { class: "page-head" },
        heading,
        count,
        h("span", { class: "grow" }),
        actions,
      ),
      h(
        "p",
        { class: "page-note" },
        `Deleted templates stay ${String(TRASH_DAYS)} days, then are removed.`,
      ),
      list,
      status,
    ),
  );
  void loading.then(load);
  return { dispose: () => undefined };
}
