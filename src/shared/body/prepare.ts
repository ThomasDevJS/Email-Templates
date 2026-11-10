import { AppError, ErrorCode } from "../errors/codes";
import { scanBody, type Warning } from "../placeholders/validate";
import { sanitizeHtml, type SanitizeOptions } from "../sanitize/sanitize";
import { plainTextOf, snippetOf, utf8Length } from "../text";

/**
 * Write path for every body and subject (save, duplicate, restore, import): sanitize, then placeholder and subject
 * validation (ADR-0004, spec 5.6). Runs before the script lock. Problems become one VALIDATION error whose
 * `details.problems` the editor lists.
 */
export interface PreparedBody {
  readonly html: string;
  /** Trimmed subject; "" leaves the draft subject alone. */
  readonly subject: string;
  readonly plainText: string;
  readonly snippet: string;
  readonly sizeBytes: number;
  /** Over subject and body together. */
  readonly placeholders: string[];
  /** Over subject and body together. */
  readonly prompts: string[];
  readonly warnings: Warning[];
}

export function prepareBody(
  raw: string,
  options: SanitizeOptions = {},
  rawSubject = "",
): PreparedBody {
  const { html, attrTokens } = sanitizeHtml(raw, options);
  const subject = rawSubject.trim();
  const scan = scanBody(html, attrTokens, subject);
  if (scan.problems.length > 0) {
    const count = scan.problems.length;
    throw new AppError(
      ErrorCode.VALIDATION,
      `${String(count)} problem${count === 1 ? "" : "s"} to fix`,
      { problems: scan.problems, warnings: scan.warnings },
    );
  }
  const plainText = plainTextOf(html);
  return {
    html,
    subject,
    plainText,
    snippet: snippetOf(plainText),
    sizeBytes: utf8Length(html),
    placeholders: scan.placeholders,
    prompts: scan.prompts,
    warnings: scan.warnings,
  };
}
