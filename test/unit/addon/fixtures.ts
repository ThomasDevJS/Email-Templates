import type { DetailsState } from "../../../src/addon/cards/details";
import { NO_RECIPIENTS } from "../../../src/shared/model/recipients";
import type {
  SidebarHome,
  SidebarTemplate,
} from "../../../src/shared/model/sidebar";

/** Sidebar view data shared by the add-on card and flow tests. */
export function template(
  id: string,
  fields: Partial<SidebarTemplate> = {},
): SidebarTemplate {
  return {
    id,
    folderId: "F1",
    title: `Template ${id}`,
    subject: "",
    snippet: `Snippet ${id}`,
    version: 1,
    prompts: [],
    level: "use",
    ...fields,
  };
}

export function view(fields: Partial<SidebarHome> = {}): SidebarHome {
  return {
    folders: [
      { id: "F1", name: "Sales", parentId: "", count: 3 },
      { id: "MY", name: "My templates", parentId: "", count: 0 },
    ],
    subfolders: [{ id: "F2", name: "Quotes", parentId: "F1", count: 1 }],
    templates: [
      template("T1", { prompts: ["Meeting date", "Product"] }),
      template("T2", { snippet: "" }),
      template("T3", { folderId: "F2" }),
    ],
    favorites: [],
    recent: [],
    personalTemplates: "on",
    ...fields,
  };
}

/** A freshly opened compose details card of `template("T1")`: no fields, no subject, no recipients. */
export function details(fields: Partial<DetailsState> = {}): DetailsState {
  return {
    template: template("T1"),
    subject: "",
    plan: { added: NO_RECIPIENTS, notAdded: [], unknown: NO_RECIPIENTS },
    domain: "migway.com",
    version: 1,
    values: {},
    fields: [],
    entered: [],
    order: [],
    problem: "",
    replaceSubject: true,
    addRecipients: true,
    rh: "RH",
    counted: false,
    ...fields,
  };
}
