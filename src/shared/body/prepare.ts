import { AppError, ErrorCode } from "../errors/codes";
import { scanBody, type Warning } from "../placeholders/validate";
import { sanitizeHtml, type SanitizeOptions } from "../sanitize/sanitize";
import { plainTextOf, snippetOf, utf8Length } from "../text";

/**
 * Write path for every body (save, restore, import): sanitize, then placeholder validation (ADR-0004).
 * Runs before the script lock. Problems become one VALIDATION error whose `details.problems` the editor lists.
 */
export interface PreparedBody {
  readonly html: string;
  readonly plainText: string;
  readonly snippet: string;
  readonly sizeBytes: number;
  readonly placeholders: string[];
  readonly prompts: string[];
  readonly warnings: Warning[];
}

export function prepareBody(
  raw: string,
  options: SanitizeOptions = {},
): PreparedBody {
  const { html, attrTokens } = sanitizeHtml(raw, options);
  const scan = scanBody(html, attrTokens);
  if (scan.problems.length > 0) {
    const count = scan.problems.length;
    throw new AppError(
      ErrorCode.VALIDATION,
      `${String(count)} placeholder problem${count === 1 ? "" : "s"}`,
      { problems: scan.problems, warnings: scan.warnings },
    );
  }
  const plainText = plainTextOf(html);
  return {
    html,
    plainText,
    snippet: snippetOf(plainText),
    sizeBytes: utf8Length(html),
    placeholders: scan.placeholders,
    prompts: scan.prompts,
    warnings: scan.warnings,
  };
}
