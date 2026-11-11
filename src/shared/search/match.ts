import { editDistance } from "../placeholders/distance";

/**
 * Template search (spec 4.4), shared by the sidebar `search` op, `search.body` and the web app filter.
 * Case- and accent-insensitive token prefix match. Weights: title 3, subject 2, tags 2, folder 2, body 1.
 * One typo is tolerated for terms of 5 or more characters, at half weight. Every term must match some field.
 * `folder:<name>` and `tag:<name>` filter by token prefix and add no score. Only the web app passes `addresses`
 * (spec 5.7, Q39): a query word that is a prefix of a To, Cc or Bcc address (its local part, or the full address
 * once it holds `@`) matches at weight 1; a domain alone matches nothing.
 */
export interface Query {
  readonly terms: readonly string[];
  readonly folders: readonly string[];
  readonly tags: readonly string[];
  /** The plain words of the query, whole and as their terms; matched against addresses. */
  readonly words?: readonly QueryWord[];
}

export interface QueryWord {
  readonly text: string;
  readonly terms: readonly string[];
}

export interface SearchFields {
  readonly title: string;
  readonly subject: string;
  readonly tags: readonly string[];
  /** Folder path, "Sales / Quotes". */
  readonly folder: string;
  readonly body: string;
  /** To, Cc and Bcc addresses (web app library only). */
  readonly addresses?: readonly string[];
}

type TextField = Exclude<keyof SearchFields, "addresses">;
const ADDRESS_WEIGHT = 1;

const WEIGHTS: Readonly<Record<TextField, number>> = {
  title: 3,
  subject: 2,
  tags: 2,
  folder: 2,
  body: 1,
};
const FUZZY_MIN = 5;
/** Longer queries are cut; no real search needs more. */
export const QUERY_MAX = 200;

/** Lower case without accents, for matching. */
export function fold(text: string): string {
  return text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

function tokens(text: string): string[] {
  return fold(text)
    .split(/[^\p{L}\p{N}]+/u)
    .filter((token) => token !== "");
}

export function parseQuery(raw: string): Query {
  const terms: string[] = [];
  const folders: string[] = [];
  const tags: string[] = [];
  const words: QueryWord[] = [];
  for (const word of fold(raw.slice(0, QUERY_MAX)).split(/\s+/)) {
    const operator = /^(folder|tag):(.+)$/.exec(word);
    const value = tokens(operator?.[2] ?? word);
    if (operator?.[1] === "folder") folders.push(...value);
    else if (operator?.[1] === "tag") tags.push(...value);
    else if (value.length > 0) {
      terms.push(...value);
      words.push({ text: word, terms: value });
    }
  }
  return { terms, folders, tags, words };
}

export function isEmptyQuery(query: Query): boolean {
  return (
    query.terms.length === 0 &&
    query.folders.length === 0 &&
    query.tags.length === 0
  );
}

/** 1 for a token prefix, 0.5 for one typo (terms of 5 or more characters), else 0. */
function termMatch(term: string, words: readonly string[]): number {
  if (words.some((word) => word.startsWith(term))) return 1;
  if (term.length < FUZZY_MIN) return 0;
  const typo = words.some(
    (word) =>
      editDistance(term, word.slice(0, term.length)) <= 1 ||
      editDistance(term, word) <= 1,
  );
  return typo ? 0.5 : 0;
}

/** Tokens per text field and the folded addresses, built once per item. */
export type Indexed = Readonly<Record<TextField, readonly string[]>> & {
  readonly addresses: readonly string[];
};

export function indexFields(fields: SearchFields): Indexed {
  return {
    title: tokens(fields.title),
    subject: tokens(fields.subject),
    tags: fields.tags.flatMap(tokens),
    folder: tokens(fields.folder),
    body: tokens(fields.body),
    addresses: (fields.addresses ?? []).map(fold),
  };
}

const prefixOf = (words: readonly string[]) => (value: string) =>
  words.some((word) => word.startsWith(value));

/** Relevance of one item, 0 when it does not match. A query of operators only scores 1 for every match. */
export function score(query: Query, item: Indexed): number {
  if (!query.folders.every(prefixOf(item.folder))) return 0;
  if (!query.tags.every(prefixOf(item.tags))) return 0;
  if (query.terms.length === 0) return 1;
  if (item.addresses.length === 0 || query.words === undefined)
    return termsScore(query.terms, item);
  let total = 0;
  for (const word of query.words) {
    // A word without `@` is a prefix of the full address only when it is one of the local part.
    const address = item.addresses.some((a) => a.startsWith(word.text))
      ? ADDRESS_WEIGHT
      : 0;
    const best = Math.max(termsScore(word.terms, item), address);
    if (best === 0) return 0;
    total += best;
  }
  return total;
}

/** Sum of the best field weight per term, 0 when one term matches no field. */
function termsScore(terms: readonly string[], item: Indexed): number {
  let total = 0;
  for (const term of terms) {
    const best = Math.max(
      ...Object.entries(WEIGHTS).map(
        ([field, weight]) => weight * termMatch(term, item[field as TextField]),
      ),
    );
    if (best === 0) return 0;
    total += best;
  }
  return total;
}

/**
 * Matches in order: relevance, then last used by the caller (position in the caller's recent list), then title.
 */
export function rank<T extends { readonly id: string; readonly title: string }>(
  items: readonly T[],
  query: Query,
  fieldsOf: (item: T) => SearchFields,
  recent: readonly string[],
): T[] {
  const used = new Map(recent.map((id, n) => [id, n]));
  const lastUsed = (item: T) => used.get(item.id) ?? recent.length;
  return items
    .map((item) => ({ item, score: score(query, indexFields(fieldsOf(item))) }))
    .filter((entry) => entry.score > 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        lastUsed(a.item) - lastUsed(b.item) ||
        a.item.title.localeCompare(b.item.title),
    )
    .map((entry) => entry.item);
}
