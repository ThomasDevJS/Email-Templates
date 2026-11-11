import { AppError, ErrorCode } from "../errors/codes";
import {
  NO_RECIPIENTS,
  validateRecipients,
  type RecipientPolicy,
  type Recipients,
} from "../model/recipients";
import { scanBody, type Warning } from "../placeholders/validate";
import { sanitizeHtml, type SanitizeOptions } from "../sanitize/sanitize";
import { plainTextOf, snippetOf, utf8Length } from "../text";

/**
 * Write path for every body, subject and recipient list (save, duplicate, restore, import): sanitize, then
 * placeholder, subject and recipient validation (ADR-0004, spec 5.6, 5.7). Runs before the script lock. Problems
 * become one VALIDATION error whose `details.problems` the editor lists.
 */
export interface PreparedBody {
  readonly html: string;
  /** Trimmed subject; "" leaves the draft subject alone. */
  readonly subject: string;
  /** Normalized To, Cc, Bcc (spec 5.7). */
  readonly recipients: Recipients;
  readonly plainText: string;
  readonly snippet: string;
  readonly sizeBytes: number;
  /** Over subject and body together. */
  readonly placeholders: string[];
  /** Over subject and body together. */
  readonly prompts: string[];
  readonly warnings: Warning[];
}

/** The VALIDATION error of a save: "n problems to fix" with the problems the editor lists. */
export function problemsError(
  problems: readonly unknown[],
  warnings: readonly Warning[],
): AppError {
  const count = problems.length;
  return new AppError(
    ErrorCode.VALIDATION,
    `${String(count)} problem${count === 1 ? "" : "s"} to fix`,
    { problems, warnings },
  );
}

export function prepareBody(
  raw: string,
  options: SanitizeOptions = {},
  rawSubject = "",
  rawRecipients: { lists: Recipients; policy: RecipientPolicy } = {
    lists: NO_RECIPIENTS,
    policy: { domain: "", external: "allow" },
  },
): PreparedBody {
  const { html, attrTokens } = sanitizeHtml(raw, options);
  const subject = rawSubject.trim();
  const scan = scanBody(html, attrTokens, subject);
  const { recipients, problems: recipientProblems } = validateRecipients(
    rawRecipients.lists,
    rawRecipients.policy,
  );
  const problems = [...scan.problems, ...recipientProblems];
  if (problems.length > 0) throw problemsError(problems, scan.warnings);
  const plainText = plainTextOf(html);
  return {
    html,
    subject,
    recipients,
    plainText,
    snippet: snippetOf(plainText),
    sizeBytes: utf8Length(html),
    placeholders: scan.placeholders,
    prompts: scan.prompts,
    warnings: scan.warnings,
  };
}
