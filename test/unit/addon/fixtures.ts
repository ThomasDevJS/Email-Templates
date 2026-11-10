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
    ...fields,
  };
}
