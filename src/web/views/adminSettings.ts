import {
  SETTINGS,
  type SettingEntry,
  type SettingName,
  type SettingValue,
  isSettingValue,
} from "../../shared/model/settings";
import { ErrorCode } from "../../shared/errors/codes";
import { conflictText, lastChangeText, settingTexts } from "../admin/model";
import type { ConfigView } from "../rpc/api";
import { openDialog } from "../ui/dialog";
import { h, uid } from "../ui/dom";
import { RpcError } from "../rpc/client";
import { adminLineText } from "../ui/status";
import { adminsSection } from "./adminAdmins";
import type { AppContext } from "./context";

/** The current entry a CONFLICT carries in `details` (ADR-0008 section 2), or null for any other error. */
export function conflictEntry(
  error: unknown,
  name: SettingName,
): SettingEntry | null {
  if (!(error instanceof RpcError) || error.code !== ErrorCode.CONFLICT)
    return null;
  const { value, updatedAt, updatedBy } = error.details ?? {};
  return isSettingValue(name, value) &&
    typeof updatedAt === "string" &&
    typeof updatedBy === "string"
    ? { value, updatedAt, updatedBy }
    : null;
}

/**
 * Config tab, section "Settings" (wireframe 06, spec 7.3, ADR-0008 section 5): per setting a fieldset with the
 * explanation, a radio group, the last change and Save. Save is disabled while the choice equals the current value
 * and asks first when the change takes something away from users (Cancel focused). A change by another admin
 * meanwhile shows the conflict text and the current value.
 */
function settingBlock(
  app: AppContext,
  name: SettingName,
  start: SettingEntry,
  domain: string,
): HTMLElement {
  const texts = settingTexts(name, domain);
  let current = start;
  const group = uid(`setting-${name}`);
  const explanationId = uid("setting-help");
  const options = texts.options.map(([value, label]) => {
    const radio = h("input", { type: "radio", name: group, value });
    return { radio, label: h("label", {}, radio, ` ${label}`) };
  });
  const radios = options.map((option) => option.radio);
  const last = h("p", { class: "hint" });
  // Focusable by script: Save is disabled once the choice is saved, so its focus moves here (never to the body).
  const status = h("p", {
    class: "status",
    role: "status",
    "aria-live": "polite",
    tabindex: "-1",
  });
  const save = h("button", { type: "button", class: "primary" }, "Save");
  let busy = false;

  const chosen = (): SettingValue =>
    (radios.find((radio) => radio.checked)?.value ??
      current.value) as SettingValue;
  const sync = () => {
    save.disabled = chosen() === current.value;
  };
  const show = (entry: SettingEntry) => {
    current = entry;
    for (const radio of radios) radio.checked = radio.value === entry.value;
    last.textContent = lastChangeText(entry);
    sync();
  };
  const finish = () => {
    busy = false;
    save.removeAttribute("aria-disabled");
    save.textContent = "Save";
    const hadFocus = document.activeElement === save;
    sync();
    if (hadFocus && save.disabled) status.focus();
  };

  const run = (value: SettingValue) => {
    // Save stays enabled while busy (`aria-disabled`): a disabled button drops its focus to the page body.
    busy = true;
    save.setAttribute("aria-disabled", "true");
    save.textContent = "Saving...";
    status.textContent = "Saving...";
    app.api
      .setSetting(name, value, current)
      .then((result) => {
        // A stale page whose choice equals the current value answers `changed: false` with a newer entry.
        const otherAdmin =
          !result.changed && result.updatedAt !== current.updatedAt;
        show(result);
        status.textContent = otherAdmin
          ? conflictText(result)
          : texts.saved(result.value);
      })
      .catch((error: unknown) => {
        const newer = conflictEntry(error, name);
        if (newer === null) {
          status.textContent = adminLineText(error, app.fail(error));
          return;
        }
        show(newer);
        status.textContent = conflictText(newer);
      })
      .finally(finish);
  };

  save.addEventListener("click", () => {
    if (busy) return;
    const value = chosen();
    const confirm = texts.confirms.find((entry) => entry.value === value);
    if (confirm === undefined) {
      run(value);
      return;
    }
    openDialog({
      title: confirm.title,
      body: h("p", {}, confirm.body),
      actions: [
        { label: "Cancel", autofocus: true, run: () => undefined },
        {
          label: confirm.action,
          primary: true,
          run: () => {
            run(value);
            return undefined;
          },
        },
      ],
      returnFocus: save,
    });
  });
  for (const radio of radios) radio.addEventListener("change", sync);
  show(current);

  return h(
    "fieldset",
    { class: "setting", "aria-describedby": explanationId },
    h("legend", {}, texts.legend),
    h("p", { id: explanationId, class: "setting-help" }, texts.explanation),
    h("div", { class: "scope" }, ...options.map((option) => option.label)),
    last,
    h("div", { class: "setting-actions" }, save, status),
  );
}

export function settingsSection(
  app: AppContext,
  data: ConfigView,
): HTMLElement {
  const names = Object.keys(SETTINGS) as SettingName[];
  return h(
    "section",
    { class: "settings", "aria-labelledby": "settings-heading" },
    h("h2", { id: "settings-heading", class: "first" }, "Settings"),
    ...names.map((name) =>
      settingBlock(app, name, data.settings[name], data.domain),
    ),
    adminsSection(app, data),
  );
}
