import { describe, expect, it } from "vitest";
import { variableValues } from "../../../src/shared/model/sidebar";

describe("variableValues", () => {
  it("maps sender fields and the recipient first name to registry names", () => {
    expect(
      variableValues(
        { name: "N", title: "T", phone: "P", department: "D" },
        "R",
      ),
    ).toEqual({
      "sender.name": "N",
      "sender.title": "T",
      "sender.phone": "P",
      "sender.department": "D",
      "recipient.first_name": "R",
    });
  });
});
