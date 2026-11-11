import type { AdminEntry } from "../../shared/model/admins";
import { addedByText, fixedAdminTexts } from "../admin/model";
import type { AdminsResult, ConfigView } from "../rpc/api";
import { openDialog } from "../ui/dialog";
import { h, replace, uid } from "../ui/dom";
import { ErrorCode } from "../../shared/errors/codes";
import { adminLineText, toRpcError } from "../ui/status";
import type { AppContext } from "./context";

/**
 * Config tab, Settings, section "Admins" (D32, wireframe 06, spec 7.3): the in-app list with Remove (none on the
 * caller's own row), the owner's and the group's admins read only, and the add form. Add and Remove share one status
 * line; after either, the list shows the op's `admins` and focus moves to the status line. The server checks all.
 */
export function adminsSection(app: AppContext, data: ConfigView): HTMLElement {
  const self = app.profile()?.email.trim().toLowerCase() ?? "";
  const helpId = uid("admins-help");
  const inputId = uid("admin-email");
  const statusId = uid("admins-status");
  const list = h("div", {});
  // Focusable by script: after a change the focused control may be gone (a removed row).
  const status = h("p", {
    id: statusId,
    class: "status",
    role: "status",
    "aria-live": "polite",
    tabindex: "-1",
  });
  const input = h("input", {
    type: "email",
    id: inputId,
    autocomplete: "off",
    spellcheck: "false",
    "aria-describedby": statusId,
  });
  const addButton = h(
    "button",
    { type: "submit", class: "primary" },
    "Add admin",
  );
  let busy = false;

  /** `typed`: the call checks the address in the field, so a VALIDATION answer marks the field. */
  const run = (
    busyText: string,
    call: () => Promise<AdminsResult>,
    done: (result: AdminsResult) => string,
    typed: boolean,
  ) => {
    busy = true;
    status.textContent = busyText;
    input.removeAttribute("aria-invalid");
    call()
      .then((result) => {
        show(result.admins);
        status.textContent = done(result);
      })
      .catch((error: unknown) => {
        const rpc = toRpcError(error);
        // The Directory could not answer: the server's own text in the line, no toast (spec 7.3).
        status.textContent =
          rpc.details?.["reason"] === "ADMIN_CHECK"
            ? rpc.message
            : adminLineText(error, app.fail(error));
        if (typed && rpc.code === ErrorCode.VALIDATION)
          input.setAttribute("aria-invalid", "true");
      })
      .finally(() => {
        busy = false;
        addButton.removeAttribute("aria-disabled");
        addButton.textContent = "Add admin";
        status.focus();
      });
  };

  const confirmRemove = (email: string, button: HTMLButtonElement) => {
    openDialog({
      title: `Remove ${email} as admin?`,
      body: h(
        "p",
        {},
        "They lose admin access at their next action. Their templates and folders stay.",
      ),
      actions: [
        { label: "Cancel", autofocus: true, run: () => undefined },
        {
          label: "Remove admin",
          primary: true,
          run: () => {
            run(
              "Removing...",
              () => app.api.removeAdmin(email),
              (result) =>
                result.changed
                  ? `${result.email} is no longer an admin.`
                  : `${result.email} is not in the list.`,
              false,
            );
            return undefined;
          },
        },
      ],
      returnFocus: button,
    });
  };

  const row = (entry: AdminEntry) => {
    const own = entry.email === self;
    const button = own
      ? null
      : h(
          "button",
          { type: "button", "aria-label": `Remove ${entry.email} as admin` },
          "Remove",
        );
    button?.addEventListener("click", () => {
      if (!busy) confirmRemove(entry.email, button);
    });
    return h(
      "li",
      {},
      h(
        "div",
        {},
        h("span", { class: "row-title" }, entry.email),
        h("p", { class: "hint" }, addedByText(entry)),
      ),
      button,
    );
  };

  const show = (admins: readonly AdminEntry[]) => {
    replace(
      list,
      admins.length === 0
        ? h("p", { class: "empty" }, "No admins added here yet.")
        : h(
            "ul",
            { class: "admins", "aria-label": "Admins added here" },
            ...admins.map(row),
          ),
    );
  };

  const form = h(
    "form",
    // The server checks the address and answers the spec 7.3 texts; the browser bubble would hide them.
    { class: "admin-add", novalidate: "" },
    h(
      "div",
      { class: "field" },
      h("label", { for: inputId }, "Email address"),
      input,
    ),
    h("div", { class: "setting-actions" }, addButton, status),
  );
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (busy) return;
    // Add stays enabled while busy (`aria-disabled`): a disabled button drops its focus to the page body.
    addButton.setAttribute("aria-disabled", "true");
    addButton.textContent = "Adding...";
    const typed = input.value;
    run(
      "Adding...",
      () => app.api.addAdmin(typed),
      (result) => {
        input.value = "";
        return result.changed
          ? `${result.email} is now an admin.`
          : `${result.email} is already an admin.`;
      },
      true,
    );
  });
  show(data.admins);

  return h(
    "fieldset",
    { class: "setting admins-setting", "aria-describedby": helpId },
    h("legend", {}, "Admins"),
    h(
      "p",
      { id: helpId, class: "setting-help" },
      `Admins manage every shared folder, grants, settings, imports and backups. Add people by their ${data.domain} address.`,
    ),
    list,
    ...fixedAdminTexts(data.breakGlass, data.adminGroup).map((text) =>
      h("p", { class: "hint" }, text),
    ),
    form,
  );
}
