import { AppError, ErrorCode } from "../../shared/errors/codes";
import { variableValues } from "../../shared/model/sidebar";
import { utf8Length } from "../../shared/text";
import { reqString } from "../dispatch/args";
import type { HandlerContext } from "../dispatch/context";
import { isS4Fixture, s4Fixture } from "../../shared/spike/s4Fixtures";
import { recipientFirstName, senderOf } from "./sidebar";

/**
 * TEMPORARY (spike S4). Op `spike.s4`, admin only (policy row `admin.ops`): one insert fixture of ADR-0004.
 * F8 is filled with the caller's sender values and the internal recipient's first name, like `template.apply`.
 */
export function spikeS4(context: HandlerContext): {
  fixture: string;
  html: string;
  bytes: number;
} {
  const fixture = reqString(context.args, "fixture");
  if (!isS4Fixture(fixture))
    throw new AppError(ErrorCode.VALIDATION, "fixture: expected F1 to F9");
  const values =
    fixture === "F8"
      ? variableValues(senderOf(context), recipientFirstName(context))
      : {};
  const html = s4Fixture(fixture, values);
  return { fixture, html, bytes: utf8Length(html) };
}
