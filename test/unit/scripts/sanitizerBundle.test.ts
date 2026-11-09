import { build } from "esbuild";
import { join } from "node:path";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";

const ROOT = join(import.meta.dirname, "..", "..", "..");

/**
 * htmlparser2 must run in Apps Script V8: an IIFE with no Node globals (no `require`, `process`, `Buffer`).
 * The bundle runs in a bare V8 context that has only the ECMAScript built-ins.
 */
describe("sanitizer bundle in a bare V8 context", () => {
  it("sanitizes without Node globals", async () => {
    const result = await build({
      stdin: {
        contents:
          'import { sanitize } from "./src/shared/sanitize/sanitize"; globalThis.out = sanitize(input);',
        resolveDir: ROOT,
        loader: "ts",
      },
      bundle: true,
      format: "iife",
      target: "es2020",
      platform: "neutral",
      mainFields: ["module", "main"],
      write: false,
      logLevel: "silent",
    });
    const code = result.outputFiles[0]?.text ?? "";
    expect(code).not.toMatch(/\brequire\(|\bprocess\.|\bBuffer\./);
    const context: Record<string, unknown> = {
      input: '<p onclick="x">a &amp; b<script>x</script></p>',
    };
    runInNewContext(code, context);
    expect(context["out"]).toBe("<p>a &amp; b</p>");
  });
});
