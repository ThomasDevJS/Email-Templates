import { describe, expect, it } from "vitest";
import {
  QUERY_MAX,
  fold,
  indexFields,
  isEmptyQuery,
  parseQuery,
  rank,
  score,
  type SearchFields,
} from "../../../src/shared/search/match";

const fields = (partial: Partial<SearchFields>): SearchFields => ({
  title: "",
  subject: "",
  tags: [],
  folder: "",
  body: "",
  ...partial,
});

describe("parseQuery", () => {
  it("folds case and accents and splits operators from terms", () => {
    expect(parseQuery("  Café folder:Sales/Quotes TAG:Prix-net hi ")).toEqual({
      terms: ["cafe", "hi"],
      folders: ["sales", "quotes"],
      tags: ["prix", "net"],
      words: [
        { text: "cafe", terms: ["cafe"] },
        { text: "hi", terms: ["hi"] },
      ],
    });
    expect(isEmptyQuery(parseQuery(" ; "))).toBe(true);
    expect(isEmptyQuery(parseQuery("tag:x"))).toBe(false);
  });

  it("cuts the query at 200 characters", () => {
    expect(parseQuery(`${"a".repeat(QUERY_MAX)}bbb`).terms).toEqual([
      "a".repeat(QUERY_MAX),
    ]);
  });

  it("fold removes combining marks", () => {
    expect(fold("ÉLÈVE Ñandú")).toBe("eleve nandu");
  });
});

describe("score (spec 4.4 weights)", () => {
  const scoreOf = (query: string, partial: Partial<SearchFields>) =>
    score(parseQuery(query), indexFields(fields(partial)));

  it.each([
    ["title", 3],
    ["subject", 2],
    ["folder", 2],
    ["body", 1],
  ] as const)("a prefix in %s scores %d", (field, weight) => {
    expect(scoreOf("quo", { [field]: "The Quote" })).toBe(weight);
  });

  it("tags score 2; the best field counts once per term; every term must match", () => {
    expect(scoreOf("quo", { tags: ["quotes"] })).toBe(2);
    expect(scoreOf("quo", { title: "quote", body: "quote" })).toBe(3);
    expect(scoreOf("quo intro", { title: "quote", body: "intro" })).toBe(4);
    expect(scoreOf("quo zzz", { title: "quote" })).toBe(0);
  });

  it("allows one typo at half weight for terms of 5 or more characters", () => {
    expect(scoreOf("qoute", { title: "quote" })).toBe(0);
    expect(scoreOf("quotr", { title: "quote" })).toBe(1.5);
    expect(scoreOf("remindr", { title: "reminder" })).toBe(1.5);
    expect(scoreOf("quot", { title: "quit" })).toBe(0);
  });

  it("operators filter by token prefix and score 1 alone", () => {
    expect(scoreOf("folder:sal", { folder: "Sales / Quotes" })).toBe(1);
    expect(scoreOf("folder:quo", { folder: "Sales / Quotes" })).toBe(1);
    expect(scoreOf("folder:hr", { folder: "Sales" })).toBe(0);
    expect(scoreOf("tag:pri x", { tags: ["pricing"], title: "x" })).toBe(3);
    expect(scoreOf("tag:pri", { tags: [] })).toBe(0);
  });
});

describe("score on addresses (spec 5.7, Q39)", () => {
  const scoreOf = (query: string, partial: Partial<SearchFields>) =>
    score(parseQuery(query), indexFields(fields(partial)));
  const addresses = ["s9-to@migway.com", "Ana.Lima@example.com"];

  it("matches a local part prefix or a full address prefix at weight 1", () => {
    expect(scoreOf("s9", { addresses })).toBe(1);
    expect(scoreOf("s9-to", { addresses })).toBe(1);
    expect(scoreOf("ana.li", { addresses })).toBe(1);
    expect(scoreOf("s9-to@mig", { addresses })).toBe(1);
    expect(scoreOf("S9-TO@MIGWAY.COM", { addresses })).toBe(1);
  });

  it("matches nothing on the domain alone or on a later part of the local part", () => {
    expect(scoreOf("migway", { addresses })).toBe(0);
    expect(scoreOf("migway.com", { addresses })).toBe(0);
    expect(scoreOf("@migway", { addresses })).toBe(0);
    expect(scoreOf("lima", { addresses })).toBe(0);
  });

  it("needs every word to match a field or an address, and keeps the field score when higher", () => {
    expect(scoreOf("quote s9", { title: "Quote", addresses })).toBe(4);
    expect(scoreOf("quote zzz", { title: "Quote", addresses })).toBe(0);
    expect(scoreOf("ana", { title: "Ana", addresses })).toBe(3);
  });

  it("scores like before when an item has no addresses", () => {
    expect(scoreOf("s9-to", { title: "s9 to" })).toBe(6);
    expect(scoreOf("s9", {})).toBe(0);
  });
});

describe("rank", () => {
  const items = [
    { id: "a", title: "Beta note" },
    { id: "b", title: "Alpha note" },
    { id: "c", title: "Note title" },
    { id: "d", title: "Other" },
  ];
  const fieldsOf = (item: { title: string }) => fields({ title: item.title });

  it("orders by relevance, then the caller's last use, then title", () => {
    const ranked = rank(items, parseQuery("note"), fieldsOf, ["a"]);
    expect(ranked.map((item) => item.id)).toEqual(["a", "b", "c"]);
    expect(
      rank(items, parseQuery("note"), fieldsOf, []).map((item) => item.id),
    ).toEqual(["b", "a", "c"]);
  });
});
