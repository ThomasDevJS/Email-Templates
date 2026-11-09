import { describe, expect, it } from "vitest";
import { localPage } from "../../../scripts/lib/html.mjs";
import { BUDGET_BYTES } from "../../../scripts/lib/budget.mjs";
import { DEV_PAGE_VALUES, webPage } from "../../../scripts/web.mjs";

describe("web app page (ADR-0005 inlined bundle)", () => {
  it("leaves the dev harness out of the production page and stays under budget", async () => {
    const page = await webPage({ harness: false });
    expect(page).not.toContain("Simulated ");
    expect(page).not.toContain("dev.user@example.com");
    expect(page).not.toMatch(/<script[^>]+src=|<link[^>]+href=/);
    expect(Buffer.byteLength(page)).toBeLessThan(BUDGET_BYTES["index.html"]);
    expect(page).toContain("<?= email ?>");
  });

  it("includes the harness only when asked, and fills scriptlets for local serving", async () => {
    const page = localPage(await webPage({ harness: true }), DEV_PAGE_VALUES);
    expect(page).toContain("Simulated ");
    expect(page).toContain("dev.user@example.com");
    expect(page).not.toContain("<?=");
    expect(page).toContain('<meta name="viewport"');
  });

  it("escapes scriptlet values", () => {
    expect(
      localPage('<meta charset="utf-8" /><p><?= email ?></p><?= missing ?>', {
        email: '<a&"b>',
      }),
    ).toBe(
      '<meta charset="utf-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1" /><p>&lt;a&amp;&quot;b&gt;</p>',
    );
  });
});
