import { S4_FIXTURES, S4_LABELS } from "../../shared/spike/s4Fixtures";
import { action, type CardSpec } from "./spec";

/**
 * TEMPORARY (spike S4, ADR-0004). Fixture list for the owner's insert runs; docs/spikes/slice-04-insert.md has
 * the steps. Each Insert appends one line with the measured callback time to the draft.
 */
export function spikeCard(): CardSpec {
  return {
    name: "spike-s4",
    title: "Spike S4 insert fixtures",
    sections: [
      {
        widgets: [
          {
            kind: "text",
            text: "Temporary admin tool. Insert one fixture at a time, then record the result.",
          },
          ...S4_FIXTURES.map((fixture) => ({
            kind: "item" as const,
            text: `${fixture}: ${S4_LABELS[fixture]}`,
            button: {
              text: "Insert",
              alt: `Insert fixture ${fixture}`,
              action: action("onSpikeInsert", { fixture }),
            },
          })),
        ],
      },
    ],
  };
}

/** Last paragraph of every fixture insert: callback time from click handling to response, and server time. */
export function timingLine(
  fixture: string,
  bytes: number,
  callbackMs: number,
  serverMs: number,
): string {
  return `<p>[S4 ${fixture}: ${String(bytes)} bytes, add-on callback ${String(callbackMs)} ms, server ${String(serverMs)} ms]</p>`;
}
