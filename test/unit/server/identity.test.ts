import { beforeEach, describe, expect, it } from "vitest";
import {
  lookupProfile,
  PROFILE_TTL_S,
  toProfile,
} from "../../../src/server/directory/profile";
import { OWNER, setupWorld, type World } from "../../fakes/world";

const ANA = "ana@example.com";
let world: World;

beforeEach(() => {
  world = setupWorld();
});

const DIRECTORY_USER = {
  name: { fullName: "Ana Lima", givenName: "Ana" },
  organizations: [
    { title: "Intern", department: "Ops" },
    { primary: true, title: "Sales Lead", department: "Sales" },
  ],
  phones: [
    { type: "mobile", value: "+1 555 0100" },
    { type: "work", value: "+1 555 0199" },
  ],
};

describe("Directory profile (ADR-0004 Sender values)", () => {
  it("maps fullName, primary organization, work phone and givenName", () => {
    expect(toProfile(ANA, DIRECTORY_USER)).toEqual({
      email: ANA,
      name: "Ana Lima",
      givenName: "Ana",
      title: "Sales Lead",
      department: "Sales",
      phone: "+1 555 0199",
    });
  });

  it("falls back to the first organization and first phone, and to blanks", () => {
    expect(
      toProfile(ANA, {
        organizations: [{ title: "T" }],
        phones: [{ value: "1" }],
      }),
    ).toMatchObject({ title: "T", department: "", phone: "1" });
    expect(toProfile(ANA, undefined)).toEqual({
      email: ANA,
      name: "",
      givenName: "",
      title: "",
      department: "",
      phone: "",
    });
  });

  it("calls domain_public basic once and caches the profile for 6 h", () => {
    world.directory.users.set(ANA, DIRECTORY_USER);
    expect(lookupProfile(world.services, ANA).name).toBe("Ana Lima");
    expect(lookupProfile(world.services, ANA).name).toBe("Ana Lima");
    expect(world.directory.calls).toEqual([
      {
        email: ANA,
        options: { viewType: "domain_public", projection: "basic" },
      },
    ]);
    world.clock.now += PROFILE_TTL_S * 1000;
    lookupProfile(world.services, ANA);
    expect(world.directory.calls).toHaveLength(2);
  });

  it("keeps no address in any Script Cache key: profiles of sender and recipient, apply, home, lists", () => {
    world.directory.users.set(ANA, DIRECTORY_USER);
    const folder = world.ok<{ id: string }>(OWNER, "folder.create", {
      name: "Sales",
    });
    const item = world.ok<{ id: string }>(OWNER, "template.create", {
      folderId: folder.id,
      title: "T",
      html: "<p>x</p>",
      to: ["bob@example.com"],
    });
    world.ok(OWNER, "profile.me");
    world.ok(OWNER, "sidebar.home");
    world.ok(OWNER, "template.list");
    world.ok(OWNER, "template.apply", {
      id: item.id,
      knownVersion: 0,
      recipientEmailIfInternal: ANA,
    });
    const keys = world.cache.keys();
    expect(keys.some((key) => key.startsWith("prof:"))).toBe(true);
    expect(keys.filter((key) => key.includes("@"))).toEqual([]);
    const calls = world.directory.calls.length;
    expect(lookupProfile(world.services, "ANA@example.com").givenName).toBe(
      "Ana",
    );
    expect(world.directory.calls).toHaveLength(calls);
  });

  it("returns blanks without caching when the Directory lookup fails", () => {
    expect(lookupProfile(world.services, "ghost@example.com").name).toBe("");
    world.directory.users.set("ghost@example.com", DIRECTORY_USER);
    expect(lookupProfile(world.services, "ghost@example.com").name).toBe(
      "Ana Lima",
    );
  });

  it("serves profile.me to any domain caller for their own email only", () => {
    world.directory.users.set(ANA, DIRECTORY_USER);
    expect(world.ok(ANA, "profile.me", { email: OWNER })).toMatchObject({
      email: ANA,
      title: "Sales Lead",
    });
  });
});

describe("logger redaction (spec section 11)", () => {
  it("never writes bodies, prompt values or recipient addresses to the log", () => {
    const folder = world.ok<{ id: string }>(OWNER, "folder.create", {
      name: "Sales",
    });
    world.lines.length = 0;
    const secretBody = "<p>SECRET-BODY-TEXT</p>";
    const item = world.ok<{ id: string }>(OWNER, "template.create", {
      folderId: folder.id,
      title: "T",
      html: secretBody,
    });
    world.call(OWNER, "template.update", {
      id: item.id,
      baseVersion: 1,
      title: "T",
      html: "<p>SECRET-2</p>",
    });
    world.call(OWNER, "template.apply", {
      id: item.id,
      prompts: { "Meeting date": "SECRET-PROMPT" },
      recipientEmailIfInternal: "secret.recipient@example.com",
    });
    world.call(OWNER, "template.update", {
      id: item.id,
      baseVersion: 1,
      title: "T",
      html: "<p>SECRET-3</p>",
    });
    const log = world.lines.join("\n");
    expect(world.lines.length).toBeGreaterThanOrEqual(4);
    for (const secret of [
      "SECRET-BODY-TEXT",
      "SECRET-2",
      "SECRET-3",
      "SECRET-PROMPT",
      "secret.recipient",
    ])
      expect(log).not.toContain(secret);
    for (const line of world.lines) {
      expect(Object.keys(JSON.parse(line) as object).sort()).toEqual(
        expect.arrayContaining([
          "action",
          "actor",
          "appVersion",
          "cache",
          "durationMs",
          "level",
          "result",
          "ts",
        ]),
      );
    }
    expect(log).toContain('"cache":"hit"');
  });
});
