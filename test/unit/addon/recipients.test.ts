import { describe, expect, it } from "vitest";
import {
  FINISH_TYPING,
  addsLine,
  recipientActions,
  recipientPlan,
  recipientWidgets,
  rowHint,
} from "../../../src/addon/cards/recipients";
import { insertReply } from "../../../src/addon/cards/spec";
import {
  draftRecipients,
  type AddonEvent,
  type DraftRecipients,
} from "../../../src/addon/event";
import {
  RECIPIENT_FIELDS,
  type AppliedRecipients,
} from "../../../src/shared/model/recipients";

/** `recipientActions` truth table (spec 5.7) with REPLACE semantics (spike S6) and unknown draft fields. */
const TEMPLATE: AppliedRecipients = {
  to: ["payroll@migway.com"],
  cc: ["safety@migway.com"],
  bcc: ["records@partner.com"],
  blocked: [],
};
const EMPTY: DraftRecipients = { to: [], cc: [], bcc: [] };
const draft = (fields: Partial<DraftRecipients>): DraftRecipients => ({
  ...EMPTY,
  ...fields,
});
const KEYS = {
  to: "toRecipients",
  cc: "ccRecipients",
  bcc: "bccRecipients",
} as const;

describe("recipientActions truth table", () => {
  it("new draft (To empty): adds To, Cc and Bcc", () => {
    expect(recipientActions(TEMPLATE, EMPTY, true)).toEqual({
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
    expect(recipientActions(TEMPLATE, typed, true)).toEqual({
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
    expect(recipientActions(denied, EMPTY, true)).toEqual({
      to: ["payroll@migway.com"],
      cc: ["safety@migway.com"],
    });
    expect(recipientPlan(denied, EMPTY).notAdded).toEqual([
      { address: "records@partner.com", reason: "blocked" },
    ]);
  });

  it("off (Insert body only, switch off): no action at all", () => {
    expect(recipientActions(TEMPLATE, EMPTY, false)).toEqual({});
  });

  it("a template without recipients sends no action", () => {
    expect(
      recipientActions(
        { to: [], cc: [], bcc: [], blocked: [] },
        draft({ to: ["x@migway.com"] }),
        true,
      ),
    ).toEqual({});
  });
});

describe("unknown draft fields (never rewritten)", () => {
  const BAD: readonly [string, unknown][] = [
    ["a missing key", undefined],
    ["null", null],
    ["a string", "a@x.com"],
    ["an object", { 0: "a@x.com" }],
    ["an array with a non-string entry", ["real@y.z", null]],
  ];

  for (const field of RECIPIENT_FIELDS)
    for (const [what, value] of BAD)
      it(`${field}: ${what} is unknown and gets no action`, () => {
        const metadata: Record<string, unknown> = {
          toRecipients: [],
          ccRecipients: [],
          bccRecipients: [],
        };
        if (value === undefined) Reflect.deleteProperty(metadata, KEYS[field]);
        else metadata[KEYS[field]] = value;
        const read = draftRecipients({ draftMetadata: metadata });
        expect(read[field]).toBeNull();
        const actions = recipientActions(TEMPLATE, read, true);
        expect(actions).not.toHaveProperty(field);
        expect(Object.keys(actions)).toHaveLength(2);
        expect(recipientPlan(TEMPLATE, read).unknown[field]).toEqual(
          TEMPLATE[field],
        );
      });

  it("an unknown To counts as filled: the template To is not added", () => {
    const plan = recipientPlan(TEMPLATE, draft({ to: null }));
    expect(plan.added.to).toEqual([]);
    expect(plan.unknown.to).toEqual(["payroll@migway.com"]);
  });

  it("an unknown field still feeds nothing to the present check, a known one does", () => {
    const read = draft({ cc: null, bcc: ["safety@migway.com"] });
    expect(recipientActions(TEMPLATE, read, true)).toEqual({
      to: ["payroll@migway.com"],
      bcc: ["safety@migway.com", "records@partner.com"],
    });
  });

  it("all 3 unknown (no event): the response holds body and subject only", () => {
    for (const event of [undefined, { draftMetadata: {} }] as AddonEvent[]) {
      const read = draftRecipients(event);
      expect(read).toEqual({ to: null, cc: null, bcc: null });
      expect(
        insertReply("<p>x</p>", "S", recipientActions(TEMPLATE, read, true)),
      ).toEqual({
        kind: "insert",
        html: "<p>x</p>",
        subject: "S",
        recipients: {},
      });
    }
  });

  it("the cards say the field was not read and name the addresses to add by hand", () => {
    const plan = recipientPlan(TEMPLATE, draft({ cc: null, bcc: null }));
    expect(recipientWidgets(plan, "migway.com").slice(1)).toEqual([
      {
        kind: "text",
        text: "The draft's Cc recipients could not be read and were not changed. Add by hand: safety@migway.com.",
      },
      {
        kind: "text",
        text: "The draft's Bcc recipients could not be read and were not changed. Add by hand: records@partner.com.",
      },
      { kind: "text", text: FINISH_TYPING },
    ]);
  });
});

describe("draftRecipients (tap event)", () => {
  it("reads draftMetadata first, then gmail; an empty list is known", () => {
    expect(
      draftRecipients({
        draftMetadata: { toRecipients: ["a@x.com"], ccRecipients: [] },
        gmail: { ccRecipients: ["stale@x.com"], bccRecipients: ["b@x.com"] },
      }),
    ).toEqual({ to: ["a@x.com"], cc: [], bcc: ["b@x.com"] });
  });

  it("an empty event list lets To in", () => {
    const empty = draftRecipients({
      draftMetadata: { toRecipients: [], ccRecipients: [], bccRecipients: [] },
    });
    expect(recipientActions(TEMPLATE, empty, true).to).toEqual([
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

  it("lines carry the field, the outside and Bcc markers, Not added with the reason, and the finish-typing line", () => {
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
      { kind: "text", text: FINISH_TYPING },
    ]);
    expect(FINISH_TYPING).toBe(
      "Finish typing addresses in the draft first: an address still being typed is lost.",
    );
    expect(addsLine(plan)).toBe("Adds 2 recipients.");
    expect(
      recipientWidgets(
        recipientPlan(
          { ...TEMPLATE, to: [], bcc: [] },
          draft({ cc: ["safety@migway.com"] }),
        ),
        "migway.com",
      ),
    ).toEqual([
      {
        kind: "text",
        text: "Not added: safety@migway.com. It is already in the draft.",
      },
    ]);
  });

  it("adds line counts", () => {
    expect(
      addsLine(recipientPlan({ ...TEMPLATE, cc: [], bcc: [] }, EMPTY)),
    ).toBe("Adds 1 recipient.");
  });
});
