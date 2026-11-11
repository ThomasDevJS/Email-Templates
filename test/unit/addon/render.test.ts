import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  SLATE,
  renderCard,
  renderReply,
} from "../../../src/addon/cards/render";
import type { CardSpec } from "../../../src/addon/cards/spec";
import { homeCard, searchCard } from "../../../src/addon/cards/home";
import { detailsCard } from "../../../src/addon/cards/details";
import { details, template, view } from "./fixtures";
import {
  createRecordingCardService,
  type RecordedCall,
} from "../../fakes/output";

let calls: RecordedCall[];

beforeEach(() => {
  const cards = createRecordingCardService();
  calls = cards.calls;
  vi.stubGlobal("CardService", cards.service);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function argsOf(method: string): unknown[] {
  return calls.filter((c) => c.method === method).map((c) => c.args[0]);
}

const CARD: CardSpec = {
  name: "c1",
  title: "Title <b>",
  sections: [
    {
      header: "Head & co",
      widgets: [
        { kind: "text", text: "<script>x</script>\nline 2" },
        {
          kind: "item",
          text: "Item <i>",
          topLabel: "top",
          bottomLabel: "bottom",
          onClick: { fn: "onPreview", params: { id: "T1" } },
          button: {
            text: "Insert",
            alt: "Insert Item",
            style: "filled",
            disabled: true,
            action: { fn: "onInsert", params: { id: "T1" } },
          },
        },
        {
          kind: "buttons",
          buttons: [{ text: "Back", action: { fn: "onBack" } }],
        },
        {
          kind: "input",
          name: "p-1",
          title: "Date *",
          value: "v",
          multiline: true,
        },
      ],
    },
  ],
  footer: {
    primary: { text: "Insert", action: { fn: "onPromptInsert" } },
    secondary: { text: "Cancel", action: { fn: "onBack" } },
  },
};

describe("renderCard", () => {
  it("escapes every text, keeps newlines as <br>, and wires actions and inputs", () => {
    renderCard(CARD);
    expect(argsOf("setName")).toEqual(["c1"]);
    expect(argsOf("setTitle")).toEqual(["Title <b>", "Date *"]);
    expect(argsOf("setHeader")).toContain("Head &amp; co");
    expect(argsOf("setText")).toEqual([
      "&lt;script&gt;x&lt;/script&gt;<br>line 2",
      "Item &lt;i&gt;",
      "Insert",
      "Back",
      "Insert",
      "Cancel",
    ]);
    expect(argsOf("setTopLabel")).toEqual(["top"]);
    expect(argsOf("setBottomLabel")).toEqual(["bottom"]);
    expect(argsOf("setFunctionName")).toEqual([
      "onPreview",
      "onInsert",
      "onBack",
      "onPromptInsert",
      "onBack",
    ]);
    expect(argsOf("setParameters")).toEqual([{ id: "T1" }, { id: "T1" }]);
    expect(argsOf("setAltText")).toEqual(["Insert Item"]);
    expect(argsOf("setDisabled")).toEqual([true]);
    expect(argsOf("setTextButtonStyle")).toEqual(["FILLED"]);
    expect(argsOf("setBackgroundColor")).toEqual([SLATE]);
    expect(argsOf("setFieldName")).toEqual(["p-1"]);
    expect(argsOf("setValue")).toEqual(["v"]);
    expect(argsOf("setMultiline")).toEqual([true]);
    expect(argsOf("setPrimaryButton")).toHaveLength(1);
    expect(argsOf("setSecondaryButton")).toHaveLength(1);
    expect(argsOf("addSection")).toHaveLength(1);
  });

  it("renders a card without footer, header or optional labels", () => {
    renderCard({
      name: "c2",
      title: "T",
      sections: [{ widgets: [{ kind: "item", text: "x" }] }],
    });
    expect(argsOf("setFixedFooter")).toEqual([]);
    expect(argsOf("setHeader")).toHaveLength(1);
    expect(argsOf("setTopLabel")).toEqual([]);
    expect(argsOf("setPrimaryButton")).toEqual([]);
  });

  it("renders start icons by Material name, outlined buttons, collapsible sections, and no header without a title", () => {
    renderCard({
      name: "c4",
      sections: [
        {
          header: "Folders",
          collapseAfter: 5,
          widgets: [
            { kind: "item", icon: "folder", text: "Sales" },
            { kind: "item", text: "No icon" },
          ],
        },
        { widgets: [{ kind: "text", text: "x" }] },
      ],
      footer: {
        primary: {
          text: "Open library",
          action: { fn: "onOpenLink" },
          style: "outlined",
        },
      },
    });
    expect(SLATE).toBe("#2a3c49");
    expect(argsOf("setHeader")).toEqual(["Folders"]);
    expect(argsOf("newCardHeader")).toEqual([]);
    expect(argsOf("setName")).toEqual(["c4", "folder"]);
    expect(argsOf("setMaterialIcon")).toHaveLength(1);
    expect(argsOf("setStartIcon")).toHaveLength(1);
    expect(argsOf("setIconUrl")).toEqual([]);
    expect(argsOf("setCollapsible")).toEqual([true]);
    expect(argsOf("setNumUncollapsibleWidgets")).toEqual([5]);
    expect(argsOf("setTextButtonStyle")).toEqual(["OUTLINED"]);
    expect(argsOf("setBackgroundColor")).toEqual([]);
  });

  it("renders an input hint and change action, and an item switch", () => {
    renderCard({
      name: "c3",
      title: "T",
      sections: [
        {
          widgets: [
            {
              kind: "input",
              name: "q",
              title: "Search",
              value: "",
              multiline: false,
              hint: "folder:x",
              onChange: { fn: "onSearch" },
            },
            {
              kind: "item",
              text: "Replace the subject",
              toggle: { name: "subj", selected: true },
            },
          ],
        },
      ],
    });
    expect(argsOf("setHint")).toEqual(["folder:x"]);
    expect(argsOf("setFunctionName")).toEqual(["onSearch"]);
    expect(argsOf("setOnChangeAction")).toHaveLength(1);
    expect(argsOf("setFieldName")).toEqual(["q", "subj"]);
    expect(argsOf("setValue")).toEqual(["", "on"]);
    expect(argsOf("setSelected")).toEqual([true]);
    expect(argsOf("setControlType")).toEqual(["SWITCH"]);
    expect(argsOf("setSwitchControl")).toHaveLength(1);
  });

  it("renders a footer without a secondary button", () => {
    renderCard({
      ...CARD,
      footer: { primary: { text: "Go", action: { fn: "onBack" } } },
    });
    expect(argsOf("setSecondaryButton")).toEqual([]);
  });
});

describe("renderReply", () => {
  const card: CardSpec = { name: "n", title: "t", sections: [] };

  it.each([
    ["push", "pushCard"],
    ["update", "updateCard"],
  ] as const)("%s uses Navigation.%s", (kind, method) => {
    renderReply({ kind, card });
    expect(argsOf(method)).toHaveLength(1);
  });

  it("root pops to the root and updates it", () => {
    renderReply({ kind: "root", card });
    expect(calls.map((c) => c.method)).toContain("popToRoot");
    expect(argsOf("updateCard")).toHaveLength(1);
  });

  it("pop, notify and open", () => {
    renderReply({ kind: "pop" });
    expect(argsOf("popCard")).toHaveLength(1);
    renderReply({ kind: "notify", text: "Hello" });
    expect(argsOf("setText")).toEqual(["Hello"]);
    renderReply({ kind: "open", url: "https://x.example" });
    expect(argsOf("setUrl")).toEqual(["https://x.example"]);
    expect(argsOf("setOpenAs")).toEqual(["OVERLAY"]);
    expect(argsOf("setOnClose")).toEqual(["RELOAD_ADD_ON"]);
  });

  it("insert with a subject adds UpdateDraftSubjectAction to the same response", () => {
    renderReply({
      kind: "insert",
      html: "<p>x</p>",
      subject: "Quote <b>",
      recipients: {},
    });
    expect(calls.map((c) => c.method)).toEqual([
      "newUpdateDraftBodyAction",
      "addUpdateContent",
      "setUpdateType",
      "newUpdateDraftActionResponseBuilder",
      "setUpdateDraftBodyAction",
      "newUpdateDraftSubjectAction",
      "addUpdateSubject",
      "setUpdateDraftSubjectAction",
      "build",
    ]);
    expect(argsOf("addUpdateSubject")).toEqual(["Quote <b>"]);
  });

  it("insert builds an UpdateDraftActionResponse with IN_PLACE_INSERT and MUTABLE_HTML", () => {
    renderReply({
      kind: "insert",
      html: "<p>x</p>",
      subject: null,
      recipients: {},
    });
    expect(calls.map((c) => c.method)).toEqual([
      "newUpdateDraftBodyAction",
      "addUpdateContent",
      "setUpdateType",
      "newUpdateDraftActionResponseBuilder",
      "setUpdateDraftBodyAction",
      "build",
    ]);
    expect(calls[1]?.args).toEqual(["<p>x</p>", "MUTABLE_HTML"]);
    expect(argsOf("setUpdateType")).toEqual(["IN_PLACE_INSERT"]);
  });

  it("insert adds one recipient action per field it carries, after body and subject, and never setSendStatus", () => {
    renderReply({
      kind: "insert",
      html: "<p>x</p>",
      subject: "S",
      recipients: { cc: ["a@x.com", "b@x.com"], bcc: ["c@x.com"] },
    });
    const methods = calls.map((c) => c.method);
    expect(methods.slice(-8)).toEqual([
      "setUpdateDraftSubjectAction",
      "newUpdateDraftCcRecipientsAction",
      "addUpdateCcRecipients",
      "setUpdateDraftCcRecipientsAction",
      "newUpdateDraftBccRecipientsAction",
      "addUpdateBccRecipients",
      "setUpdateDraftBccRecipientsAction",
      "build",
    ]);
    expect(methods).not.toContain("setUpdateDraftToRecipientsAction");
    expect(methods).not.toContain("setSendStatus");
    expect(argsOf("addUpdateCcRecipients")).toEqual([["a@x.com", "b@x.com"]]);
    renderReply({
      kind: "insert",
      html: "",
      subject: null,
      recipients: { to: ["t@x.com"] },
    });
    expect(argsOf("addUpdateToRecipients")).toEqual([["t@x.com"]]);
  });
});

describe("labels (plain text in Gmail)", () => {
  const labels = () => [...argsOf("setTopLabel"), ...argsOf("setBottomLabel")];

  it("get no markup from the code's own strings; folder names stay escaped on one line", () => {
    const name = "R&D <b>Research and development of long names</b>";
    renderCard(
      homeCard(
        view({
          folders: [{ id: "F1", name, parentId: "", count: 2 }],
          subfolders: [
            {
              id: "F2",
              name: "Quotes for every region",
              parentId: "F1",
              count: 1,
            },
          ],
          templates: [
            template("T1", { folderId: "F2", prompts: ["A"], rc: [1, 1, 0] }),
          ],
          favorites: ["T1"],
        }),
        "compose",
      ),
    );
    const escaped =
      "R&amp;D &lt;b&gt;Research and development of long names&lt;/b&gt;";
    expect(labels()).toEqual([
      `Adds To 1, Cc 1 · 1 field to fill · ${escaped} / Quotes for every region`,
      "2 templates",
    ]);
    calls.length = 0;
    renderCard(
      detailsCard(
        details({
          subject: "S",
          plan: {
            added: { to: ["a@example.com"], cc: [], bcc: ["b@example.com"] },
            notAdded: [],
            unknown: { to: [], cc: [], bcc: [] },
          },
        }),
      ),
    );
    expect(labels().length).toBeGreaterThan(2);
    for (const text of labels()) expect(String(text)).not.toMatch(/[<>]/);
  });

  it("escapes the query echoed in the no-match text", () => {
    renderCard(searchCard(view(), "<b>x</b>", [], "compose"));
    expect(argsOf("setText")[0]).toContain("&lt;b&gt;x&lt;/b&gt;");
  });
});
