import {
  folderPath,
  moveTargets,
  rowActions,
  type RowAction,
} from "../library/model";
import type { ItemRow } from "../rpc/api";
import { openDialog } from "../ui/dialog";
import { h, uid } from "../ui/dom";
import type { MenuItem } from "../ui/menu";
import type { AppContext } from "./context";

/**
 * Row menu of the library grid (wireframe 03): Edit, Duplicate, Move, History, Delete, as far as the caller's
 * level allows. Move offers only folders where the caller holds edit; Delete asks first and soft-deletes.
 * `done` gets the status text and the template ID to focus once the list is drawn again ("" for none).
 */
export type Done = (status: string, focusId: string) => void;

interface Outcome {
  readonly status: string;
  readonly focusId: string;
}

/** Runs one server action, reloads the library and reports. A failure shows the usual toast or banner text. */
async function act(
  app: AppContext,
  item: ItemRow,
  work: () => Promise<Outcome>,
  done: Done,
): Promise<void> {
  try {
    const outcome = await work();
    await app.reload();
    done(outcome.status, outcome.focusId);
  } catch (error: unknown) {
    const shown = app.fail(error);
    await app.reload();
    done(shown?.textContent ?? "", item.id);
  }
}

function askMove(app: AppContext, item: ItemRow, done: Done): void {
  const id = uid("move-folder");
  const select = h(
    "select",
    { id },
    ...moveTargets(item, app.folders()).map((option) =>
      h("option", { value: option.id }, option.label),
    ),
  );
  openDialog({
    title: "Move template",
    body: h(
      "div",
      { class: "field" },
      h("label", { for: id }, `Move "${item.title}" to`),
      select,
    ),
    actions: [
      {
        label: "Move",
        primary: true,
        run: () => {
          const target = select.value;
          void act(
            app,
            item,
            async () => {
              await app.api.move(item.id, target, item.version);
              return {
                status: `Moved "${item.title}" to ${folderPath(app.folders(), target)}.`,
                focusId: item.id,
              };
            },
            done,
          );
          return true;
        },
      },
      { label: "Cancel", run: () => true },
    ],
  });
}

function askDelete(app: AppContext, item: ItemRow, done: Done): void {
  openDialog({
    title: "Delete template",
    body: h(
      "p",
      {},
      `Delete "${item.title}"? Deleted templates stay in the trash for 30 days.`,
    ),
    actions: [
      {
        label: "Delete",
        primary: true,
        run: () => {
          void act(
            app,
            item,
            async () => {
              await app.api.remove(item.id, item.version);
              return { status: `Deleted "${item.title}".`, focusId: "" };
            },
            done,
          );
          return true;
        },
      },
      { label: "Cancel", run: () => true },
    ],
  });
}

export function rowMenu(
  app: AppContext,
  item: ItemRow,
  done: Done,
): MenuItem[] {
  const entries: Readonly<Record<RowAction, MenuItem>> = {
    edit: {
      label: "Edit",
      run: () => {
        app.go({ name: "edit", id: item.id });
      },
    },
    duplicate: {
      label: "Duplicate",
      run: () => {
        void act(
          app,
          item,
          async () => {
            const copy = await app.api.duplicate(item.id);
            return {
              status: `Duplicated as "${copy.title}".`,
              focusId: copy.id,
            };
          },
          done,
        );
      },
    },
    move: {
      label: "Move...",
      run: () => {
        askMove(app, item, done);
      },
    },
    history: {
      label: "History",
      run: () => {
        app.go({ name: "history", id: item.id });
      },
    },
    delete: {
      label: "Delete...",
      run: () => {
        askDelete(app, item, done);
      },
    },
  };
  return rowActions(item, app.folders()).map((action) => entries[action]);
}
