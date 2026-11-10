import { describe, expect, it } from "vitest";
import {
  addsLine,
  recipientActions,
  recipientPlan,
  recipientWidgets,
  rowHint,
  switchLabel,
} from "../../../src/addon/cards/recipients";
import { draftRecipients } from "../../../src/addon/event";
import {
  NO_RECIPIENTS,
  type AppliedRecipients,
  type Recipients,
} from "../../../src/shared/model/recipients";

/** `recipientActions` truth table (spec 5.7) with REPLACE semantics (spike S6). */
const TEMPLATE: AppliedRecipients = {
  to: ["payroll@migway.com"],
  cc: ["safety@migway.com"],
  bcc: ["records@partner.com"],
  blocked: [],
};
const draft = (fields: Partial<Recipients>): Recipients => ({
  ...NO_RECIPIENTS,
  ...fields,
});

describe("recipientActions truth table", () => {
  it("new draft (To empty): adds To, Cc and Bcc", () => {
    expect(recipientActions(TEMPLATE, NO_RECIPIENTS, true)).toEqual({
      to: ["payroll@migway.com"],
      cc: ["safety@migway.com"],
      bcc: ["records@partner.com"],
    });
  });

  it("draft To filled (reply, typed To): no To action; Cc and Bcc carry the draft list then the new addresses", () => {
    const reply = draft({
      to: ["Driver@Example.org"],
      cc: ["boss@migway.com"],
    });
    expect(recipientActions(TEMPLATE, reply, true)).toEqual({
      cc: ["boss@migway.com", "safety@migway.com"],
      bcc: ["records@partner.com"],
    });
    expect(recipientPlan(TEMPLATE, reply).notAdded).toEqual([
      { address: "payroll@migway.com", reason: "to" },
    ]);
  });

  it("forward (To empty, Cc filled): To added, the draft Cc kept first", () => {
    expect(
      recipientActions(TEMPLATE, draft({ cc: ["a@migway.com"] }), true),
    ).toEqual({
      to: ["payroll@migway.com"],
      cc: ["a@migway.com", "safety@migway.com"],
      bcc: ["records@partner.com"],
    });
  });

  it("an address already in the draft in different case: skipped, its field gets no action", () => {
    const typed = draft({ cc: ["Safety@MIGWAY.com"] });
    const actions = recipientActions(TEMPLATE, typed, true);
    expect(actions).not.toHaveProperty("cc");
    expect(actions).toEqual({
      to: ["payroll@migway.com"],
      bcc: ["records@partner.com"],
    });
    expect(recipientPlan(TEMPLATE, typed).notAdded).toEqual([
      { address: "safety@migway.com", reason: "present" },
    ]);
  });

  it("an address present in another draft field: skipped (Bcc address already in To)", () => {
    const typed = draft({ to: [" Records@Partner.com "] });
    expect(recipientActions(TEMPLATE, typed, true)).toEqual({
      cc: ["safety@migway.com"],
    });
    expect(recipientPlan(TEMPLATE, typed).notAdded).toEqual([
      { address: "payroll@migway.com", reason: "to" },
      { address: "records@partner.com", reason: "present" },
    ]);
  });

  it("reads the part inside <...> of a draft entry", () => {
    const typed = draft({ bcc: ["Records <records@partner.com>"] });
    expect(recipientActions(TEMPLATE, typed, true)).not.toHaveProperty("bcc");
  });

  it("an address in To present in the draft To counts as present, not as the To rule", () => {
    expect(
      recipientPlan(TEMPLATE, draft({ to: ["payroll@migway.com"] })).notAdded,
    ).toEqual([{ address: "payroll@migway.com", reason: "present" }]);
  });

  it("blocked addresses are never added and are listed", () => {
    const denied = { ...TEMPLATE, bcc: [], blocked: ["records@partner.com"] };
    expect(recipientActions(denied, NO_RECIPIENTS, true)).toEqual({
      to: ["payroll@migway.com"],
      cc: ["safety@migway.com"],
    });
    expect(recipientPlan(denied, NO_RECIPIENTS).notAdded).toEqual([
      { address: "records@partner.com", reason: "blocked" },
    ]);
  });

  it("off (Insert body only, switch off): no action at all", () => {
    expect(recipientActions(TEMPLATE, NO_RECIPIENTS, false)).toEqual({});
  });

  it("a template without recipients sends no action", () => {
    expect(
      recipientActions(
        { ...NO_RECIPIENTS, blocked: [] },
        draft({ to: ["x@migway.com"] }),
        true,
      ),
    ).toEqual({});
  });
});

describe("draftRecipients (tap event)", () => {
  it("reads draftMetadata first, then gmail; a missing or bad list is empty", () => {
    expect(draftRecipients(undefined)).toEqual(NO_RECIPIENTS);
    expect(
      draftRecipients({
        draftMetadata: { toRecipients: ["a@x.com"], ccRecipients: [] },
        gmail: { ccRecipients: ["stale@x.com"], bccRecipients: ["b@x.com"] },
      }),
    ).toEqual({ to: ["a@x.com"], cc: [], bcc: ["b@x.com"] });
    expect(
      draftRecipients({ draftMetadata: { bccRecipients: "x" } }).bcc,
    ).toEqual([]);
  });

  it("an empty and a missing event list both let To in", () => {
    const empty = draftRecipients({ draftMetadata: { toRecipients: [] } });
    const missing = draftRecipients({ draftMetadata: {} });
    for (const lists of [empty, missing])
      expect(recipientActions(TEMPLATE, lists, true).to).toEqual([
        "payroll@migway.com",
      ]);
  });
});

describe("texts (spec 7.1)", () => {
  it("row hint names fields with addresses only", () => {
    expect(rowHint([1, 1, 1])).toBe("Adds To 1, Cc 1, Bcc 1");
    expect(rowHint([0, 1, 2])).toBe("Adds Cc 1, Bcc 2");
    expect(rowHint(undefined)).toBe("");
    expect(rowHint([0, 0, 0])).toBe("");
  });

  it("preview lines carry the field, the outside and Bcc markers, then Not added with the reason", () => {
    const reply = draft({ to: ["d@example.org"] });
    const plan = recipientPlan(
      { ...TEMPLATE, blocked: ["x@partner.com"] },
      reply,
    );
    expect(recipientWidgets(plan, "migway.com")).toEqual([
      { kind: "item", topLabel: "Cc", text: "safety@migway.com" },
      {
        kind: "item",
        topLabel: "Bcc",
        text: "records@partner.com",
        bottomLabel: "outside migway.com\nhidden from other recipients",
      },
      {
        kind: "text",
        text: "Not added: payroll@migway.com. The draft already has a To recipient.",
      },
      {
        kind: "text",
        text: "Not added: x@partner.com. Outside migway.com, turned off by your admin.",
      },
    ]);
    expect(addsLine(plan)).toBe("Adds 2 recipients.");
    expect(
      recipientWidgets(
        recipientPlan(TEMPLATE, draft({ cc: ["safety@migway.com"] })),
        "migway.com",
      ).at(-1),
    ).toEqual({
      kind: "text",
      text: "Not added: safety@migway.com. It is already in the draft.",
    });
  });

  it("prompt switch label lists what Insert adds with the outside marker", () => {
    const plan = recipientPlan(TEMPLATE, draft({ to: ["d@example.org"] }));
    expect(switchLabel(plan, "migway.com")).toBe(
      "Cc safety@migway.com, Bcc records@partner.com (outside migway.com)",
    );
    expect(
      addsLine(recipientPlan({ ...TEMPLATE, cc: [], bcc: [] }, NO_RECIPIENTS)),
    ).toBe("Adds 1 recipient.");
  });
});
