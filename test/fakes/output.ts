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

export function createUtilities(): { getUuid(): string } {
  let next = 1;
  return { getUuid: () => `uuid-${String(next++)}` };
}

export interface RecordedCall {
  readonly method: string;
  readonly args: readonly unknown[];
}

/**
 * CardService stand-in. Every method call is recorded as `{ method, args }` and returns the same chain,
 * so builder code runs unchanged. `OpenAs` and `OnClose` enum values are their names.
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
  };
  return {
    service: Object.assign(Object.create(chain) as object, enums),
    calls,
  };
}
