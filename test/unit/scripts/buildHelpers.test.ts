import { describe, expect, it } from "vitest";
import { BUDGET_BYTES, KB, checkBudget } from "../../../scripts/lib/budget.mjs";
import {
  countVersions,
  deploymentVersion,
  parseCreatedVersion,
  versionUsageLine,
} from "../../../scripts/lib/claspOutput.mjs";
import {
  missingForDeploy,
  parseDeployConfig,
  parseEnv,
} from "../../../scripts/lib/deployConfig.mjs";
import {
  driftedFiles,
  normalizeForDrift,
} from "../../../scripts/lib/drift.mjs";
import {
  SCRIPT_MARKER,
  STYLES_MARKER,
  inlineHtml,
} from "../../../scripts/lib/html.mjs";
import dev from "../../../deploy/dev.json";
import prod from "../../../deploy/prod.json";

describe("inlineHtml", () => {
  const template = `<style>${STYLES_MARKER}</style><script>${SCRIPT_MARKER}</script>`;

  it("replaces both markers and keeps $ sequences literal", () => {
    expect(inlineHtml(template, { script: "a('$&')", styles: "b{}" })).toBe(
      "<style>b{}</style><script>a('$&')</script>",
    );
  });

  it("requires each marker exactly once", () => {
    expect(() => inlineHtml(SCRIPT_MARKER, { script: "", styles: "" })).toThrow(
      /INLINE:styles/,
    );
  });

  it.each(["x='</script>'", "x='<?= y ?>'"])(
    "rejects unsafe script %j",
    (script) => {
      expect(() => inlineHtml(template, { script, styles: "" })).toThrow();
    },
  );
});

describe("checkBudget", () => {
  it("passes sizes under budget and reports each file", () => {
    const result = checkBudget({ "Code.js": 10 * KB, "index.html": 2 * KB });
    expect(result.errors).toEqual([]);
    expect(result.lines).toEqual([
      "Code.js: 10.0 KB of 800 KB",
      "index.html: 2.0 KB of 400 KB",
    ]);
  });

  it("fails above 800 KB for Code.js and 400 KB for index.html", () => {
    const result = checkBudget({
      "Code.js": BUDGET_BYTES["Code.js"] + 1,
      "index.html": BUDGET_BYTES["index.html"] + 1,
    });
    expect(result.errors).toHaveLength(2);
  });

  it("fails when a file is missing", () => {
    expect(checkBudget({ "Code.js": 1 }).errors).toEqual([
      "index.html missing from build output.",
    ]);
  });
});

describe("deploy config", () => {
  it("parses the committed dev and prod files", () => {
    expect(parseDeployConfig(dev).mode).toBe("head");
    expect(parseDeployConfig(prod).mode).toBe("version");
  });

  it("accepts dev and prod only", () => {
    expect(parseEnv("dev")).toBe("dev");
    expect(() => parseEnv("staging")).toThrow(/dev, prod/);
    expect(() => parseEnv(undefined)).toThrow();
  });

  it.each([
    [null, /JSON object/],
    [{ ...dev, mode: "fast" }, /mode/],
    [{ ...dev, scriptId: 1 }, /scriptId/],
    [{ ...dev, execUrl: "https://example.com/x" }, /execUrl/],
  ])("rejects %j", (raw, message) => {
    expect(() => parseDeployConfig(raw)).toThrow(message);
  });

  it("needs scriptId always, deploymentId and execUrl in version mode", () => {
    // Blank the committed IDs so the test does not depend on deploy/*.json contents.
    const blank = { scriptId: "", deploymentId: "", execUrl: "" };
    const emptyProd = parseDeployConfig({ ...prod, ...blank });
    const emptyDev = parseDeployConfig({ ...dev, ...blank });
    expect(missingForDeploy(emptyProd)).toEqual([
      "scriptId",
      "deploymentId",
      "execUrl",
    ]);
    expect(missingForDeploy(emptyDev)).toEqual(["scriptId"]);
    expect(
      missingForDeploy({ ...emptyProd, scriptId: "id", deploymentId: "dep" }),
    ).toEqual(["execUrl"]);
    expect(missingForDeploy({ ...emptyDev, scriptId: "id" })).toEqual([]);
  });
});

describe("clasp output parsers", () => {
  it("reads the created version number", () => {
    expect(parseCreatedVersion('{ "versionNumber": 12 }')).toBe(12);
    expect(() => parseCreatedVersion("{}")).toThrow(/versionNumber/);
  });

  it("counts versions", () => {
    expect(countVersions('[{"versionNumber":1},{"versionNumber":2}]')).toBe(2);
    expect(() => countVersions("{}")).toThrow(/array/);
  });

  it("finds the version a deployment serves", () => {
    const list = JSON.stringify([
      { deploymentId: "head-id", description: "Head" },
      { deploymentId: "dep-id", versionNumber: 7, description: "abc" },
    ]);
    expect(deploymentVersion(list, "dep-id")).toBe(7);
    expect(deploymentVersion(list, "head-id")).toBeUndefined();
    expect(deploymentVersion(list, "missing")).toBeUndefined();
  });

  it("advises pruning from 150 versions", () => {
    expect(versionUsageLine(3)).toBe("Versions used 3 of 200; prune at 150.");
    expect(versionUsageLine(150)).toContain("Prune old versions");
  });
});

describe("drift check", () => {
  it("compares the manifest as canonical JSON", () => {
    expect(
      normalizeForDrift("appsscript.json", '{"b":1,"a":{"d":2,"c":[3]}}'),
    ).toBe(
      normalizeForDrift(
        "appsscript.json",
        '{\n  "a": { "c": [3], "d": 2 },\n  "b": 1\n}',
      ),
    );
  });

  it("ignores line endings and trailing whitespace in code", () => {
    expect(normalizeForDrift("Code.js", "a\r\nb\n\n")).toBe("a\nb");
  });

  it("lists files whose hash changed or vanished", () => {
    const recorded = {
      "Code.js": "1",
      "index.html": "2",
      "appsscript.json": "3",
    };
    expect(driftedFiles(recorded, { ...recorded })).toEqual([]);
    expect(
      driftedFiles(recorded, { "Code.js": "9", "appsscript.json": "3" }),
    ).toEqual(["Code.js", "index.html"]);
  });
});
