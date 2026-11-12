import { createHash } from "node:crypto";

/** Minimal HtmlService, ContentService, Utilities and a recording CardService for entry point tests. */

export interface FakeHtmlOutput {
  readonly content: string;
  readonly title: string;
  readonly metaTags: Record<string, string>;
  readonly templateValues: Record<string, unknown>;
  setTitle(title: string): FakeHtmlOutput;
  addMetaTag(name: string, content: string): FakeHtmlOutput;
}

function htmlOutput(
  content: string,
  templateValues: Record<string, unknown> = {},
): FakeHtmlOutput {
  const output = {
    content,
    title: "",
    metaTags: {} as Record<string, string>,
    templateValues,
    setTitle(title: string) {
      output.title = title;
      return output;
    },
    addMetaTag(name: string, value: string) {
      output.metaTags[name] = value;
      return output;
    },
  };
  return output;
}

export function createHtmlService(): {
  createHtmlOutput(content: string): FakeHtmlOutput;
  createTemplateFromFile(
    file: string,
  ): Record<string, unknown> & { evaluate(): FakeHtmlOutput };
} {
  return {
    createHtmlOutput: (content) => htmlOutput(content),
    createTemplateFromFile(file) {
      const template: Record<string, unknown> & { evaluate(): FakeHtmlOutput } =
        {
          evaluate: () => {
            const values = Object.fromEntries(
              Object.entries(template).filter(([key]) => key !== "evaluate"),
            );
            return htmlOutput(`template:${file}`, values);
          },
        };
      return template;
    },
  };
}

export interface FakeTextOutput {
  readonly content: string;
  mimeType: string;
  setMimeType(mimeType: string): FakeTextOutput;
}

export function createContentService(): {
  MimeType: { JSON: string };
  createTextOutput(content: string): FakeTextOutput;
} {
  return {
    MimeType: { JSON: "application/json" },
    createTextOutput(content) {
      const output: FakeTextOutput = {
        content,
        mimeType: "text/plain",
        setMimeType(mimeType) {
          output.mimeType = mimeType;
          return output;
        },
      };
      return output;
    },
  };
}

export interface FakeBlob {
  getDataAsString(): string;
  getBytes(): number[];
  getContentType(): string;
  getName(): string;
}

export function fakeBlob(data: string, contentType = "", name = ""): FakeBlob {
  return {
    getDataAsString: () => data,
    getBytes: () =>
      [...Buffer.from(data, "utf8")].map((b) => (b > 127 ? b - 256 : b)),
    getContentType: () => contentType,
    getName: () => name,
  };
}

/** Utilities: UUIDs, blobs and SHA-256 digests as signed bytes, like Apps Script. */
export function createUtilities() {
  let next = 1;
  return {
    getUuid: () => `uuid-${String(next++)}`,
    newBlob: fakeBlob,
    DigestAlgorithm: { SHA_256: "SHA_256" },
    Charset: { UTF_8: "UTF_8" },
    computeDigest: (_algorithm: string, value: string): number[] =>
      [...createHash("sha256").update(value, "utf8").digest()].map((b) =>
        b > 127 ? b - 256 : b,
      ),
  };
}

export interface RecordedCall {
  readonly method: string;
  readonly args: readonly unknown[];
}

/**
 * CardService stand-in. Every method call is recorded as `{ method, args }` and returns the same chain,
 * so builder code runs unchanged. Enum values are their names.
 */
export function createRecordingCardService(): {
  service: object;
  calls: RecordedCall[];
} {
  const calls: RecordedCall[] = [];
  const chain: object = new Proxy(
    {},
    {
      get: (_target, method) => {
        if (typeof method !== "string") return undefined;
        return (...args: unknown[]) => {
          calls.push({ method, args });
          return chain;
        };
      },
    },
  );
  const enums = {
    OpenAs: { OVERLAY: "OVERLAY", FULL_SIZE: "FULL_SIZE" },
    OnClose: { RELOAD_ADD_ON: "RELOAD_ADD_ON", NOTHING: "NOTHING" },
    ContentType: { MUTABLE_HTML: "MUTABLE_HTML", TEXT: "TEXT" },
    UpdateDraftBodyType: {
      IN_PLACE_INSERT: "IN_PLACE_INSERT",
      INSERT_AT_END: "INSERT_AT_END",
    },
    TextButtonStyle: { FILLED: "FILLED", OUTLINED: "OUTLINED", TEXT: "TEXT" },
    LoadIndicator: { SPINNER: "SPINNER", NONE: "NONE" },
    HorizontalSizeStyle: {
      FILL_AVAILABLE_SPACE: "FILL_AVAILABLE_SPACE",
      FILL_MINIMUM_SPACE: "FILL_MINIMUM_SPACE",
    },
    VerticalAlignment: { CENTER: "CENTER", TOP: "TOP", BOTTOM: "BOTTOM" },
    SwitchControlType: { SWITCH: "SWITCH", CHECK_BOX: "CHECK_BOX" },
    SelectionInputType: {
      CHECK_BOX: "CHECK_BOX",
      RADIO_BUTTON: "RADIO_BUTTON",
      DROPDOWN: "DROPDOWN",
    },
    ComposedEmailType: {
      REPLY_AS_DRAFT: "REPLY_AS_DRAFT",
      STANDALONE_DRAFT: "STANDALONE_DRAFT",
    },
  };
  return {
    service: Object.assign(Object.create(chain) as object, enums),
    calls,
  };
}
