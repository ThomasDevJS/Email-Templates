import {
  SETTINGS,
  type SettingEntry,
  type SettingName,
  type SettingValue,
} from "../../shared/model/settings";
import { conflictText, lastChangeText, settingTexts } from "../admin/model";
import type { ConfigView } from "../rpc/api";
import { openDialog } from "../ui/dialog";
import { h, uid } from "../ui/dom";
import { lineText } from "../ui/status";
import type { AppContext } from "./context";

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
  const status = h("p", {
    class: "status",
    role: "status",
    "aria-live": "polite",
  });
  const save = h("button", { type: "button", class: "primary" }, "Save");

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

  const run = (value: SettingValue) => {
    save.disabled = true;
    save.textContent = "Saving...";
    status.textContent = "Saving...";
    app.api
      .setSetting(name, value, current.value)
      .then((result) => {
        // Two values only: another admin's change to the same value answers `changed: false` (CONFLICT cannot
        // happen), so a newer entry than the one shown gets the spec 7.3 conflict text.
        const otherAdmin =
          !result.changed && result.updatedAt !== current.updatedAt;
        show(result);
        status.textContent = otherAdmin
          ? conflictText(result)
          : texts.saved(result.value);
      })
      .catch((error: unknown) => {
        status.textContent = lineText(error, app.fail(error));
      })
      .finally(() => {
        save.textContent = "Save";
        sync();
      });
  };

  save.addEventListener("click", () => {
    const value = chosen();
    if (value !== texts.confirm.value) {
      run(value);
      return;
    }
    openDialog({
      title: texts.confirm.title,
      body: h("p", {}, texts.confirm.body),
      actions: [
        { label: "Cancel", autofocus: true, run: () => undefined },
        {
          label: texts.confirm.action,
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
  );
}
