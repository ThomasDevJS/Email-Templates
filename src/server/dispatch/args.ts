import { AppError, ErrorCode } from "../../shared/errors/codes";

/** Readers for op arguments. Anything malformed is a VALIDATION error naming the field. */
type Args = Readonly<Record<string, unknown>>;

function record(args: unknown): Args {
  return typeof args === "object" && args !== null && !Array.isArray(args)
    ? (args as Args)
    : {};
}

function invalid(field: string, expected: string): AppError {
  return new AppError(ErrorCode.VALIDATION, `${field}: expected ${expected}`);
}

export function optString(args: unknown, field: string): string {
  const value = record(args)[field];
  if (value === undefined || value === null) return "";
  if (typeof value !== "string") throw invalid(field, "a string");
  return value;
}

export function reqString(args: unknown, field: string): string {
  const value = optString(args, field);
  if (value.trim() === "") throw invalid(field, "a non-empty string");
  return value;
}

export function reqInt(args: unknown, field: string): number {
  const value = record(args)[field];
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0)
    throw invalid(field, "a non-negative integer");
  return value;
}

export function optBool(args: unknown, field: string): boolean {
  const value = record(args)[field];
  if (value === undefined || value === null) return false;
  if (typeof value !== "boolean") throw invalid(field, "true or false");
  return value;
}

export function optStringArray(args: unknown, field: string): string[] {
  const value = record(args)[field];
  if (value === undefined || value === null) return [];
  if (
    !Array.isArray(value) ||
    !value.every((entry) => typeof entry === "string")
  )
    throw invalid(field, "a list of strings");
  return value;
}
