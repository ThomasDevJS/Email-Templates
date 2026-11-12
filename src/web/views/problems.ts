import { h } from "../ui/dom";

/** Problems under the editor (wireframe 04): errors from the server, warnings from the local scan. */
export interface ListedProblem {
  readonly kind: "error" | "warning";
  readonly message: string;
  /** Where the problem is ("subject", "body", "to", "cc", "bcc"); its list item then moves focus there. */
  readonly field?: string;
}

export function problemList(
  problems: readonly ListedProblem[],
  focusField: (field: string) => void = () => undefined,
): HTMLElement[] {
  if (problems.length === 0) return [];
  const errors = problems.filter((problem) => problem.kind === "error").length;
  const title =
    errors > 0 ? `Problems (${String(problems.length)}):` : "Warnings:";
  return [
    h("h2", { class: "problems-title" }, title),
    h(
      "ul",
      {},
      ...problems.map((problem) => {
        const text =
          problem.kind === "warning"
            ? `Warning: ${problem.message}`
            : `Error: ${problem.message}`;
        const { field } = problem;
        return h(
          "li",
          { class: problem.kind },
          field === undefined
            ? text
            : h(
                "button",
                {
                  type: "button",
                  class: "link problem-link",
                  onclick: () => {
                    focusField(field);
                  },
                },
                text,
              ),
        );
      }),
    ),
  ];
}
