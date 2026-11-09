import { describe, expect, it } from "vitest";
import approved from "../../../scripts/approved-scopes.json";
import manifest from "../../../appsscript.json";
import { checkScopes } from "../../../scripts/lib/scopes.mjs";

const PREFIX = "https://www.googleapis.com/auth/";

describe("approved scope check (spec section 9)", () => {
  it("passes the committed manifest", () => {
    expect(checkScopes(manifest, approved)).toEqual([]);
  });

  it("manifest oauthScopes equal the approved default list exactly", () => {
    expect(manifest.oauthScopes).toEqual(approved.default);
    expect(approved.default).toHaveLength(8);
  });

  it("approved list matches the spec tables: 8 default, 4 distinct conditional", () => {
    expect(approved.default.map((scope) => scope.replace(PREFIX, ""))).toEqual([
      "gmail.addons.current.action.compose",
      "gmail.addons.current.message.metadata",
      "script.external_request",
      "drive.file",
      "userinfo.email",
      "groups",
      "admin.directory.user.readonly",
      "script.scriptapp",
    ]);
    expect(
      approved.conditional.map((scope) => scope.replace(PREFIX, "")),
    ).toEqual([
      "openid",
      "drive.readonly",
      "admin.directory.group.member.readonly",
      "directory.readonly",
    ]);
  });

  it("accepts a conditional scope", () => {
    expect(
      checkScopes({ oauthScopes: [...approved.default, "openid"] }, approved),
    ).toEqual([]);
  });

  it("rejects https://mail.google.com/ as forbidden", () => {
    expect(
      checkScopes({ oauthScopes: ["https://mail.google.com/"] }, approved),
    ).toEqual(["Forbidden scope: https://mail.google.com/"]);
  });

  it("rejects a scope outside both tables", () => {
    expect(
      checkScopes({ oauthScopes: [`${PREFIX}spreadsheets`] }, approved),
    ).toEqual([`Scope not in docs/spec.md section 9: ${PREFIX}spreadsheets`]);
  });

  it("rejects duplicates", () => {
    expect(
      checkScopes(
        { oauthScopes: [`${PREFIX}groups`, `${PREFIX}groups`] },
        approved,
      ),
    ).toEqual([`Duplicate scope: ${PREFIX}groups`]);
  });

  it.each([[{}], [null], [{ oauthScopes: "x" }], [{ oauthScopes: [1] }]])(
    "rejects a manifest without an explicit list: %j",
    (bad) => {
      expect(checkScopes(bad, approved)).toEqual([
        "appsscript.json has no explicit oauthScopes array of strings.",
      ]);
    },
  );
});

describe("manifest settings (ADR-0001, ADR-0003, ADR-0005)", () => {
  it("runs the web app as the owner for the domain", () => {
    expect(manifest.webapp).toEqual({
      executeAs: "USER_DEPLOYING",
      access: "DOMAIN",
    });
  });

  it("allows UrlFetch and openLink to the project's own web app only", () => {
    expect(manifest.urlFetchWhitelist).toEqual([
      "https://script.google.com/macros/s/",
      "https://script.googleusercontent.com/",
    ]);
    expect(manifest.addOns.common.openLinkUrlPrefixes).toEqual([
      "https://script.google.com/macros/s/",
    ]);
  });

  it("wires every manifest function to a bundle export", async () => {
    const entry = (await import("../../../src/entry")) as Record<
      string,
      unknown
    >;
    const functions = [
      manifest.addOns.common.homepageTrigger.runFunction,
      ...manifest.addOns.common.universalActions.map(
        (action) => action.runFunction,
      ),
      ...manifest.addOns.gmail.composeTrigger.selectActions.map(
        (action) => action.runFunction,
      ),
    ];
    for (const name of functions) expect(typeof entry[name]).toBe("function");
  });

  it("uses compose metadata access and the 2 advanced services", () => {
    expect(manifest.addOns.gmail.composeTrigger.draftAccess).toBe("METADATA");
    expect(manifest.dependencies.enabledAdvancedServices).toEqual([
      { userSymbol: "Drive", serviceId: "drive", version: "v3" },
      {
        userSymbol: "AdminDirectory",
        serviceId: "admin",
        version: "directory_v1",
      },
    ]);
  });
});
