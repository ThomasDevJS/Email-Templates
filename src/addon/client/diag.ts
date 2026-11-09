/**
 * Spike S2 diagnostics (temporary, slice 1). Probes the web app front door with the add-on token and
 * reports status codes, response titles and the token's scopes. Removed once ADR-0003 Part A is settled.
 */
import { BUILD_INFO } from "../../shared/buildInfo";

const EXEC_URL_V1 =
  "https://script.google.com/macros/s/AKfycbwKq1e3fMpkBN7-sp8XjgW1NZGmBxW9Q-fg5S_J7g87NosqsRVb42ZSnckrYAA2n1_S/exec";
const TOKENINFO = "https://oauth2.googleapis.com/tokeninfo?access_token=";
const MAX = 160;

function titleOf(body: string): string {
  const match = /<title>([^<]*)<\/title>/i.exec(body);
  const text = match?.[1] ?? body.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");
  return text.trim().slice(0, MAX);
}

function probe(
  label: string,
  url: string,
  method: "get" | "post",
  auth: boolean,
): string {
  try {
    const headers = auth
      ? { Authorization: `Bearer ${ScriptApp.getOAuthToken()}` }
      : {};
    const response = UrlFetchApp.fetch(url, {
      method,
      contentType: "application/json",
      payload:
        method === "post"
          ? JSON.stringify({
              op: "ping",
              args: {},
              requestId: "diag",
              clientVersion: "diag",
            })
          : undefined,
      headers,
      muteHttpExceptions: true,
      followRedirects: false,
    });
    const all = response.getAllHeaders() as Record<string, string | undefined>;
    const location = all["Location"] ?? all["location"] ?? "";
    return `${label}: ${String(response.getResponseCode())} ${location === "" ? titleOf(response.getContentText()) : "-> " + location.slice(0, MAX)}`;
  } catch (error) {
    return `${label}: threw ${String(error).slice(0, MAX)}`;
  }
}

function scopes(): string {
  try {
    const response = UrlFetchApp.fetch(TOKENINFO + ScriptApp.getOAuthToken(), {
      muteHttpExceptions: true,
    });
    const info = JSON.parse(response.getContentText()) as {
      scope?: string;
      aud?: string;
      email?: string;
    };
    const list = (info.scope ?? "")
      .split(" ")
      .map((s) => s.replace("https://www.googleapis.com/auth/", ""));
    return `token: email=${info.email ?? "?"} aud=${(info.aud ?? "?").slice(0, 20)} scopes=${list.join(", ")}`;
  } catch (error) {
    return `token: threw ${String(error).slice(0, MAX)}`;
  }
}

export function runDiagnostics(): string[] {
  return [
    `execUrl: ${BUILD_INFO.execUrl}`,
    `effective=${Session.getEffectiveUser().getEmail()} active=${Session.getActiveUser().getEmail()}`,
    scopes(),
    probe("POST dev auth", BUILD_INFO.execUrl, "post", true),
    probe("GET dev auth", BUILD_INFO.execUrl, "get", true),
    probe("POST dev noauth", BUILD_INFO.execUrl, "post", false),
    probe("POST exec v1 auth", EXEC_URL_V1, "post", true),
    probe("GET exec v1 auth", EXEC_URL_V1, "get", true),
  ];
}
