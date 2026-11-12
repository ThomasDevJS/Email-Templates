import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { textRuns } from "../../src/shared/html/escape";
import { parseText } from "../../src/shared/placeholders/grammar";
import { renderBody } from "../../src/shared/placeholders/render";
import { scanBody } from "../../src/shared/placeholders/validate";
import { EDITOR_BODIES } from "./editor/bodies";

/**
 * Bodies a build before slice 26 could store (no `{{choice:`), and what that build made of them. The expected
 * file was written on the base of slice 26 (047394e); the head must give the same result for every body.
 */
const TOKENS = [
  "{{sender.name}}",
  "Hi {{recipient.first_name|there}},",
  "Date: {{ask:Meeting date}}",
  "\\{{sender.name}}",
  "{{ sender.title }}",
  "{{ask:X|y}}",
  "{{sender.name |  Ana  }}",
  "{{sender.name|}}",
  "{{Sender.name}}",
  "{{sender}}",
  "{{sender.name}",
  "{{{sender.name}}}",
  "{{ask:  Name  }}",
  "{{ask:}}",
  "{{ask:   }}",
  `{{ask:${"x".repeat(41)}}}`,
  "{{ask:a<b}}",
  "{{ASK:Name}}",
  `{{sender.name|${"f".repeat(81)}}}`,
  "{{sender.name|a|b}}",
  "{{sender.name|a{b}}",
  "\\{{ask:Name}}",
  "\\\\{{sender.name}}",
  "a {{sender.name}} b {{ask:X}} c",
  "{{ unknown.thing }}",
  "{{date:Pickup}} and {{date: pickup }}",
  "{{ask:Pickup}} on {{date:Pickup}}",
  "{{Date:Pickup}}",
  "{{date:Pickup|tomorrow}}",
  "{{choice}} {{choicex:A}}",
  "Hi {{ask:Name}}, thanks {{sender.phone}}.",
  "{{{ask:N}}",
  "{{{sender.name}}{{ask:M}}}",
  "{{ask:N}}{ask:M}}",
].map((text) => `<p>${text}</p>`);

function sanitizerOutputs(): string[] {
  const dir = join(import.meta.dirname, "sanitizer");
  return readdirSync(dir)
    .filter((name) => name.endsWith(".expected.html"))
    .sort()
    .map((name) => readFileSync(join(dir, name), "utf8"));
}

export function oldBodies(): string[] {
  return [
    ...TOKENS,
    ...EDITOR_BODIES.map(([, html]) => html),
    ...sanitizerOutputs(),
  ];
}

/** The parts of a segment every build has had. */
function segmentShape(segment: ReturnType<typeof parseText>[number]) {
  const { kind, offset } = segment;
  if (segment.kind === "text") return { kind, offset, text: segment.text };
  if (segment.kind === "escape") return { kind, offset };
  if (segment.kind === "variable")
    return {
      kind,
      offset,
      raw: segment.raw,
      name: segment.name,
      fallback: segment.fallback,
    };
  return {
    kind,
    offset,
    raw: segment.raw,
    label: segment.label,
    type: segment.type,
  };
}

export function oldBodyResult(html: string) {
  return {
    segments: textRuns(html).map((run) =>
      parseText(run.text).map(segmentShape),
    ),
    blank: renderBody(html, { values: {}, answers: {} }).html,
    filled: renderBody(html, {
      values: { "sender.name": "Ana <A>", "sender.phone": "+1" },
      answers: { name: "Bo & Co", x: "7", "meeting date": "Mon" },
    }).html,
    scan: scanBody(html),
  };
}

const sha = (text: string): string =>
  createHash("sha256").update(text).digest("hex").slice(0, 16);

/** Body digest to result digest, the form the expected file holds (one body is 700 KB of results). */
export function oldBodyDigests(): Record<string, string> {
  return Object.fromEntries(
    oldBodies().map((html) => [
      sha(html),
      sha(JSON.stringify(oldBodyResult(html))),
    ]),
  );
}
