// TEMPORARY (spike S6): removed with src/addon/spikeS6.ts.
import { describe, expect, it, vi } from "vitest";
import { homeCard } from "../../../src/addon/cards/home";
import { view } from "./fixtures";

const build = vi.hoisted(() => ({ env: "prod" }));

vi.mock("../../../src/shared/buildInfo", () => ({
  BUILD_INFO: build,
  APP_VERSION: "x",
}));

const headers = () => homeCard(view()).sections.map((s) => s.header);

describe("home card spike S6 section", () => {
  it("is absent in a prod build", () => {
    build.env = "prod";
    expect(headers()).not.toContain("Spike S6 (temporary)");
  });

  it("is the last section in a dev build", () => {
    build.env = "dev";
    expect(headers().at(-1)).toBe("Spike S6 (temporary)");
  });
});
