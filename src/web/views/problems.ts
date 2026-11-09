import { h } from "../ui/dom";

/** Problems under the editor (wireframe 04): errors from the server, warnings from the local scan. */
export interface ListedProblem {
  readonly kind: "error" | "warning";
  readonly message: string;
}

export function problemList(problems: readonly ListedProblem[]): HTMLElement[] {
  if (problems.length === 0) return [];
  const errors = problems.filter((problem) => problem.kind === "error").length;
  const title =
    errors > 0 ? `Problems (${String(problems.length)}):` : "Warnings:";
  return [
    h("h2", { class: "problems-title" }, title),
    h(
      "ul",
      {},
      ...problems.map((problem) =>
        h(
          "li",
          { class: problem.kind },
          problem.kind === "warning"
            ? `Warning: ${problem.message}`
            : `Error: ${problem.message}`,
        ),
      ),
    ),
  ];
}
