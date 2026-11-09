/**
 * Dev harness (`npm run dev:web`, `scripts/lighthouse.mjs`): a fake `google.script` with an in-memory server, so
 * the web app runs in a local browser. Never part of the production bundle (scripts/build.mjs bundles app.ts only).
 * URL options: `?latency=<ms>` (default 120), `?fail=<CODE>&failOp=<op>` makes that op fail with that code.
 */
import { prepareBody } from "../shared/body/prepare";
import { AppError, ErrorCode, toErrorBody } from "../shared/errors/codes";
import type { Folder, Item } from "../shared/model/data";
import { scanBody } from "../shared/placeholders/validate";
import type { AccessLevel } from "../shared/permissions/levels";
import type { GoogleScript, ScriptLocation } from "./host";

interface Version {
  readonly version: number;
  readonly html: string;
  readonly savedAt: string;
  readonly savedBy: string;
  readonly restoredFrom: number;
}

const ME = "dev.user@example.com";
const NOW = "2026-11-09T14:03:00.000Z";

function folder(
  id: string,
  name: string,
  parentId: string,
  level: AccessLevel,
  kind: Folder["kind"] = "shared",
) {
  return {
    id,
    name,
    parentId,
    kind,
    level,
    ownerEmail: kind === "private" ? ME : "",
    sortOrder: 0,
    createdAt: NOW,
    createdBy: ME,
    updatedAt: NOW,
    updatedBy: ME,
    deletedAt: "",
    deletedBy: "",
    version: 1,
  };
}

const folders = [
  folder("F-SALES", "Sales", "", "manage"),
  folder("F-QUOTES", "Quotes", "F-SALES", "manage"),
  folder("F-ONBOARD", "Onboarding", "F-SALES", "manage"),
  folder("F-SUPPORT", "Support", "", "use"),
  folder("F-EMPTY", "HR", "", "edit"),
  folder("F-MINE", "My templates", "", "edit", "private"),
];

const items = new Map<string, Item>();
const versions = new Map<string, Version[]>();
let seq = 100;

function levelOf(folderId: string): AccessLevel {
  return folders.find((entry) => entry.id === folderId)?.level ?? "none";
}

function needLevel(folderId: string, need: "use" | "edit"): void {
  const have = levelOf(folderId);
  const ok =
    need === "use" ? have !== "none" : have === "edit" || have === "manage";
  if (!ok)
    throw new AppError(
      ErrorCode.DENIED,
      "You don't have access to this template.",
    );
}

function store(
  id: string,
  folderId: string,
  title: string,
  tags: string[],
  html: string,
  by = ME,
  restoredFrom = 0,
): Item {
  const body = prepareBody(html);
  const list = versions.get(id) ?? [];
  const version = list.length + 1;
  list.push({
    version,
    html: body.html,
    savedAt: new Date(Date.parse(NOW) + version * 60000).toISOString(),
    savedBy: by,
    restoredFrom,
  });
  versions.set(id, list);
  const item: Item = {
    id,
    kind: "template",
    folderId,
    title,
    subject: "",
    tags,
    status: "published",
    currentVersion: version,
    version,
    bodyFileId: `${id}.v${String(version)}`,
    snippet: body.snippet,
    placeholders: body.placeholders,
    prompts: body.prompts,
    sizeBytes: body.sizeBytes,
    createdAt: items.get(id)?.createdAt ?? NOW,
    createdBy: items.get(id)?.createdBy ?? by,
    updatedAt: list[list.length - 1]?.savedAt ?? NOW,
    updatedBy: by,
    deletedAt: "",
    deletedBy: "",
  };
  items.set(id, item);
  return item;
}

store(
  "T-QUOTE",
  "F-QUOTES",
  "Price quote 2026",
  ["pricing", "quotes"],
  "<p>Hi {{recipient.first_name|there}},</p><p>Thanks for your interest in {{ask:Product name}}.</p>",
);
store(
  "T-QUOTE",
  "F-QUOTES",
  "Price quote 2026",
  ["pricing", "quotes"],
  '<p>Hi {{recipient.first_name|there}},</p><p>Thanks for your interest in {{ask:Product name}}. Our quote for {{ask:Meeting date}} is below.</p><table border="1" cellpadding="6" cellspacing="0" style="border-collapse: collapse"><tbody><tr><th>Item</th><th>Price</th></tr><tr><td>Plan</td><td>10</td></tr></tbody></table><p><strong>{{sender.name}}</strong><br>{{sender.title}}</p>',
  "ben@example.com",
);
store(
  "T-DISCOUNT",
  "F-QUOTES",
  "Discount approval",
  ["pricing"],
  "<p>Your discount of {{ask:Discount}} is approved.</p><p>{{sender.name}}</p>",
);
store(
  "T-WELCOME",
  "F-ONBOARD",
  "Welcome email",
  ["intro"],
  "<h2>Welcome!</h2><p>We are glad to have you, {{recipient.first_name|there}}.</p><ul><li>Read the guide</li><li>Book a call</li></ul>",
);
store(
  "T-SUPPORT",
  "F-SUPPORT",
  "Ticket received",
  ["support"],
  "<p>We received your ticket and will reply within one business day.</p>",
);

function str(args: Record<string, unknown>, key: string): string {
  const value = args[key];
  return typeof value === "string" ? value : "";
}

function num(args: Record<string, unknown>, key: string): number {
  const value = args[key];
  return typeof value === "number" ? value : -1;
}

function item(id: string): Item {
  const found = items.get(id);
  if (found === undefined)
    throw new AppError(
      ErrorCode.NOT_FOUND,
      "This template was removed or moved.",
    );
  return found;
}

function checkBase(found: Item, base: number): void {
  if (found.version !== base)
    throw new AppError(ErrorCode.CONFLICT, "Changed", {
      currentVersion: found.version,
      updatedBy: found.updatedBy,
      updatedAt: found.updatedAt,
    });
}

function tags(args: Record<string, unknown>): string[] {
  const value = args["tags"];
  return Array.isArray(value)
    ? value.filter((tag): tag is string => typeof tag === "string")
    : [];
}

function title(args: Record<string, unknown>): string {
  const value = str(args, "title").trim();
  if (value === "")
    throw new AppError(
      ErrorCode.VALIDATION,
      "Title must be 1 to 120 characters",
      {
        problems: [
          {
            code: "TITLE",
            message: "Title must be 1 to 120 characters",
            offset: null,
          },
        ],
      },
    );
  return value;
}

type Op = (args: Record<string, unknown>) => unknown;

const OPS: Readonly<Record<string, Op>> = {
  "profile.me": () => ({
    email: ME,
    name: "Dev User",
    givenName: "Dev",
    title: "Sales Manager",
    department: "Sales",
    phone: "+1 555 0100",
  }),
  "folder.list": () => ({ folders }),
  "template.list": () => ({
    items: [...items.values()]
      .filter((entry) => levelOf(entry.folderId) !== "none")
      .map((entry) => ({ ...entry, level: levelOf(entry.folderId) })),
  }),
  "template.get": (args) => {
    const found = item(str(args, "id"));
    needLevel(found.folderId, "use");
    return { item: found, html: versions.get(found.id)?.at(-1)?.html ?? "" };
  },
  "template.create": (args) => {
    const folderId = str(args, "folderId");
    needLevel(folderId, "edit");
    seq += 1;
    return store(
      `T-${String(seq)}`,
      folderId,
      title(args),
      tags(args),
      str(args, "html"),
    );
  },
  "template.update": (args) => {
    const found = item(str(args, "id"));
    needLevel(found.folderId, "edit");
    checkBase(found, num(args, "baseVersion"));
    const folderId = str(args, "folderId") || found.folderId;
    needLevel(folderId, "edit");
    return store(
      found.id,
      folderId,
      title(args),
      tags(args),
      str(args, "html"),
    );
  },
  "version.list": (args) => {
    const found = item(str(args, "id"));
    needLevel(found.folderId, "edit");
    const list = [...(versions.get(found.id) ?? [])].reverse();
    return {
      id: found.id,
      title: found.title,
      currentVersion: found.currentVersion,
      versions: list.map((entry) => ({
        version: entry.version,
        savedBy: entry.savedBy,
        savedAt: entry.savedAt,
        restoredFrom: entry.restoredFrom,
        current: entry.version === found.currentVersion,
      })),
    };
  },
  "version.get": (args) => {
    const found = item(str(args, "id"));
    needLevel(found.folderId, "edit");
    const entry = versions
      .get(found.id)
      ?.find((candidate) => candidate.version === num(args, "version"));
    if (entry === undefined)
      throw new AppError(ErrorCode.NOT_FOUND, "Version not found");
    return { ...entry, prompts: scanBody(entry.html).prompts };
  },
  "version.restore": (args) => {
    const found = item(str(args, "id"));
    needLevel(found.folderId, "edit");
    checkBase(found, num(args, "baseVersion"));
    const from = num(args, "version");
    const entry = versions
      .get(found.id)
      ?.find((candidate) => candidate.version === from);
    if (entry === undefined)
      throw new AppError(ErrorCode.NOT_FOUND, "Version not found");
    return store(
      found.id,
      found.folderId,
      found.title,
      [...found.tags],
      entry.html,
      ME,
      from,
    );
  },
};

function reply(op: string, args: unknown): unknown {
  const params = new URLSearchParams(window.location.search);
  const started = Date.now();
  try {
    const fail = params.get("fail");
    if (fail !== null && (params.get("failOp") ?? op) === op)
      throw new AppError(fail as ErrorCode, `Simulated ${fail}`);
    const handler = OPS[op];
    if (handler === undefined)
      throw new AppError(
        ErrorCode.NOT_IMPLEMENTED,
        `${op} is not in the dev harness`,
      );
    const data = handler((args ?? {}) as Record<string, unknown>);
    return {
      ok: true,
      data: JSON.parse(JSON.stringify(data)) as unknown,
      serverVersion: "dev",
      durationMs: Date.now() - started,
    };
  } catch (error: unknown) {
    return {
      ok: false,
      error: toErrorBody(error),
      serverVersion: "dev",
      durationMs: Date.now() - started,
    };
  }
}

function fakeRun(
  onReply: (value: unknown) => void = () => undefined,
  onFailure: (error: unknown) => void = () => undefined,
): GoogleScript["run"] {
  const latency = Number(
    new URLSearchParams(window.location.search).get("latency") ?? "120",
  );
  return {
    withSuccessHandler: (handler) => fakeRun(handler, onFailure),
    withFailureHandler: (handler) => fakeRun(onReply, handler),
    rpc: (op, args) => {
      window.setTimeout(() => {
        onReply(reply(op, args));
      }, latency);
    },
  };
}

function currentLocation(): ScriptLocation {
  return {
    hash: window.location.hash.replace(/^#/, ""),
    parameter: Object.fromEntries(new URLSearchParams(window.location.search)),
  };
}

const fake: GoogleScript = {
  run: fakeRun(),
  url: {
    getLocation: (callback) => {
      window.setTimeout(() => {
        callback(currentLocation());
      }, 0);
    },
  },
  history: {
    push: (_state, _params, hash) => {
      window.history.pushState(null, "", `#${hash}`);
    },
    replace: (_state, _params, hash) => {
      window.history.replaceState(null, "", `#${hash}`);
    },
    setChangeHandler: (handler) => {
      window.addEventListener("popstate", () => {
        handler({ location: currentLocation() });
      });
    },
  },
};

(window as unknown as { google: { script: GoogleScript } }).google = {
  script: fake,
};
