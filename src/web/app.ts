/** Browser code for the web app shell, bundled and inlined into index.html by scripts/build.mjs. */

interface ScriptRun {
  withSuccessHandler(handler: (value: unknown) => void): ScriptRun;
  withFailureHandler(handler: (error: Error) => void): ScriptRun;
  rpc(op: string, args: unknown): void;
}

declare const google: { readonly script: { readonly run: ScriptRun } };

function describeReply(value: unknown): string {
  if (typeof value !== "object" || value === null) return "Unexpected reply";
  const reply = value as {
    ok?: unknown;
    durationMs?: unknown;
    error?: { code?: unknown };
  };
  if (reply.ok === true) return `Ping ok (${String(reply.durationMs)} ms)`;
  return `Ping failed: ${String(reply.error?.code)}`;
}

function ping(output: HTMLElement): void {
  output.textContent = "Pinging...";
  google.script.run
    .withSuccessHandler((value) => {
      output.textContent = describeReply(value);
    })
    .withFailureHandler((error) => {
      output.textContent = `Ping failed: ${error.message}`;
    })
    .rpc("ping", {});
}

function start(): void {
  const button = document.getElementById("ping");
  const output = document.getElementById("ping-result");
  if (button === null || output === null) return;
  button.addEventListener("click", () => {
    ping(output);
  });
}

start();
