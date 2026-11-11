/**
 * Dev harness (`npm run dev:web`, `scripts/lighthouse.mjs`): a fake `google.script` with an in-memory server, so
 * the web app runs in a local browser. Never part of the production bundle (scripts/build.mjs bundles app.ts only).
 * URL options: `?latency=<ms>` (default 120), `?fail=<CODE>&failOp=<op>` makes that op fail with that code,
 * `?admin=0` makes the caller a manage holder instead of an admin in the admin view, `?sample=freight` loads
 * freight templates with invented names for screenshots (the tests use the default sample), `?personal=off` starts
 * with personal templates off (My templates at `use`), `?access=none` shows no folder at all.
 */
import { prepareBody } from "../shared/body/prepare";
import { AppError, ErrorCode, toErrorBody } from "../shared/errors/codes";
import type { Folder, Item } from "../shared/model/data";
import {
  isSettingName,
  isSettingValue,
  type SettingEntry,
  type SettingName,
} from "../shared/model/settings";
import { scanBody } from "../shared/placeholders/validate";
import type { AccessLevel } from "../shared/permissions/levels";
import type { GoogleScript, ScriptLocation } from "./host";

interface Version {
  readonly version: number;
  readonly subject: string;
  readonly html: string;
  readonly savedAt: string;
  readonly savedBy: string;
  readonly restoredFrom: number;
}

const ME = "dev.user@example.com";
const NOW = "2026-11-09T14:03:00.000Z";
const PARAMS = new URLSearchParams(window.location.search);
const FREIGHT = PARAMS.get("sample") === "freight";
const PERSONAL_OFF = PARAMS.get("personal") === "off";
const MINE_LEVEL: AccessLevel = PERSONAL_OFF ? "use" : "edit";
const NO_ACCESS = PARAMS.get("access") === "none";

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

const folders = FREIGHT
  ? [
      folder("F-DISPATCH", "Dispatch", "", "manage"),
      folder("F-RATES", "Rate confirmations", "F-DISPATCH", "manage"),
      folder("F-DELAYS", "Delays and updates", "F-DISPATCH", "manage"),
      folder("F-CARRIER", "Carrier relations", "", "manage"),
      folder("F-BILLING", "Billing", "", "edit"),
      folder("F-EMPTY", "HR", "", "edit"),
      folder("F-MINE", "My templates", "", MINE_LEVEL, "private"),
    ].map((entry, sortOrder) => ({ ...entry, sortOrder }))
  : [
      folder("F-SALES", "Sales", "", "manage"),
      folder("F-QUOTES", "Quotes", "F-SALES", "manage"),
      folder("F-ONBOARD", "Onboarding", "F-SALES", "manage"),
      folder("F-SUPPORT", "Support", "", "use"),
      folder("F-EMPTY", "HR", "", "edit"),
      folder("F-MINE", "My templates", "", MINE_LEVEL, "private"),
    ];

const items = new Map<string, Item>();
const versions = new Map<string, Version[]>();
const favorites = new Set<string>(
  FREIGHT ? ["T-RATECON", "T-POD"] : ["T-QUOTE"],
);
let seq = 100;

function levelOf(folderId: string): AccessLevel {
  if (NO_ACCESS) return "none";
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
  subject = "",
): Item {
  const body = prepareBody(html, {}, subject);
  const list = versions.get(id) ?? [];
  const version = list.length + 1;
  list.push({
    version,
    subject: body.subject,
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
    subject: body.subject,
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

/** Moves the last version of `id` to `at` by `by`, so the sample shows a spread of times and authors. */
function dated(id: string, at: string, by: string): void {
  const list = versions.get(id) ?? [];
  const last = list.pop();
  if (last !== undefined) list.push({ ...last, savedAt: at, savedBy: by });
  const found = items.get(id);
  if (found !== undefined)
    items.set(id, { ...found, updatedAt: at, updatedBy: by });
}

const BEN = "ben.kowalski@example.com";
const ANA = "ana.moreno@example.com";
const TOM = "thomas.olsen@example.com";
const SIGN = "<p><strong>{{sender.name}}</strong><br>{{sender.title}}</p>";

/** Freight sample: [id, folder, title, tags, subject, body, author, time]. */
const FREIGHT_TEMPLATES: readonly (readonly [
  string,
  string,
  string,
  string[],
  string,
  string,
  string,
  string,
])[] = [
  [
    "T-DELAY",
    "F-DELAYS",
    "Delivery delay notice",
    ["customer"],
    "Update on your delivery {{ask:Load number}}",
    `<p>Hi {{recipient.first_name|there}},</p><p>Load {{ask:Load number}} is running late. The new delivery estimate is {{ask:New delivery time}}.</p><p>We will send another update when the truck leaves {{ask:Current location}}.</p>${SIGN}`,
    TOM,
    "2026-11-09T11:40:00.000Z",
  ],
  [
    "T-POD",
    "F-BILLING",
    "Proof of delivery request",
    ["pod", "carrier"],
    "POD needed for load {{ask:Load number}}",
    `<p>Hi {{recipient.first_name|there}},</p><p>Please send the signed proof of delivery for load {{ask:Load number}} so we can release payment.</p>${SIGN}`,
    ANA,
    "2026-11-08T16:12:00.000Z",
  ],
  [
    "T-ONBOARD",
    "F-CARRIER",
    "Carrier onboarding welcome",
    ["onboarding"],
    "Welcome to the Migway carrier network",
    `<p>Hi {{recipient.first_name|there}},</p><p>Welcome aboard. Your carrier profile is active, and our dispatch desk will send your first offers this week.</p><ul><li>Insurance certificate on file</li><li>W-9 received</li></ul>${SIGN}`,
    BEN,
    "2026-11-07T09:30:00.000Z",
  ],
  [
    "T-INVOICE",
    "F-BILLING",
    "Invoice follow-up",
    ["invoice"],
    "Invoice {{ask:Invoice number}} is past due",
    `<p>Hi {{recipient.first_name|there}},</p><p>Invoice {{ask:Invoice number}} for {{ask:Amount}} was due on {{ask:Due date}}. Please let us know when payment is scheduled.</p>${SIGN}`,
    ANA,
    "2026-11-06T15:55:00.000Z",
  ],
  [
    "T-PICKUP",
    "F-DELAYS",
    "Pickup appointment confirmed",
    ["customer", "pickup"],
    "Pickup confirmed for {{ask:Pickup date}}",
    `<p>Hi {{recipient.first_name|there}},</p><p>Your pickup is booked for {{ask:Pickup date}} between {{ask:Time window}}.</p>${SIGN}`,
    TOM,
    "2026-11-05T10:18:00.000Z",
  ],
  [
    "T-DETENTION",
    "F-BILLING",
    "Detention charge notice",
    ["detention"],
    "Detention at {{ask:Facility}} on {{ask:Date}}",
    `<p>Hi {{recipient.first_name|there}},</p><p>Our driver waited {{ask:Hours}} hours at {{ask:Facility}}. Detention is billed at the agreed hourly rate.</p>${SIGN}`,
    ANA,
    "2026-11-04T13:02:00.000Z",
  ],
  [
    "T-CHECKCALL",
    "F-DISPATCH",
    "Driver check call reminder",
    ["driver"],
    "Check call due for load {{ask:Load number}}",
    `<p>Hi {{recipient.first_name|there}},</p><p>Please call dispatch with your location and ETA for load {{ask:Load number}}.</p>${SIGN}`,
    TOM,
    "2026-11-03T08:45:00.000Z",
  ],
  [
    "T-BOOKED",
    "F-MINE",
    "Quick reply: load booked",
    [],
    "",
    "<p>Thanks, the load is booked. Confirmation follows within the hour.</p>",
    ME,
    "2025-12-18T17:20:00.000Z",
  ],
];

function seedFreight(): void {
  const rate = (restoredFrom: number) =>
    `<p>Hi {{recipient.first_name|there}},</p><p>Thank you for covering load {{ask:Load number}}. Please confirm the rate below for pickup on {{ask:Pickup date}}.</p><table border="1" cellpadding="6" cellspacing="0" style="border-collapse: collapse"><tbody><tr><th>Lane</th><th>Equipment</th><th>Rate</th></tr><tr><td>{{ask:Lane}}</td><td>53' dry van</td><td>{{ask:Rate}}</td></tr></tbody></table><p>Reply to this email to accept${restoredFrom > 0 ? "" : " by end of day"}. Our dispatch desk answers at {{sender.phone}}.</p>${SIGN}`;
  const history: readonly [string, string, number][] = [
    [TOM, "2026-11-06T10:12:00.000Z", 0],
    [ANA, "2026-11-08T09:47:00.000Z", 0],
    [TOM, "2026-11-08T17:31:00.000Z", 0],
    [BEN, "2026-11-09T14:05:00.000Z", 2],
  ];
  for (const [by, at, from] of history) {
    store(
      "T-RATECON",
      "F-RATES",
      "Rate confirmation",
      ["rates", "carrier"],
      rate(from),
      by,
      from,
      "Rate confirmation for load {{ask:Load number}}",
    );
    dated("T-RATECON", at, by);
  }
  for (const [
    id,
    folderId,
    title,
    tags,
    subject,
    html,
    by,
    at,
  ] of FREIGHT_TEMPLATES) {
    store(id, folderId, title, tags, html, by, 0, subject);
    dated(id, at, by);
  }
  const trashed: readonly [string, string, string, string, string][] = [
    [
      "T-FUEL",
      "F-BILLING",
      "Fuel surcharge table 2025",
      ANA,
      "2026-11-01T10:00:00.000Z",
    ],
    [
      "T-WEEKEND",
      "F-DISPATCH",
      "Weekend dispatch contacts",
      TOM,
      "2026-11-06T18:20:00.000Z",
    ],
  ];
  for (const [id, folderId, title, by, at] of trashed) {
    store(id, folderId, title, [], "<p>Retired.</p>", by);
    items.set(id, { ...(items.get(id) as Item), deletedAt: at, deletedBy: by });
  }
}

function seedDefault(): void {
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
    0,
    "Quote for {{ask:Product name}}",
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

  store(
    "T-OLD",
    "F-QUOTES",
    "Old price list",
    ["pricing"],
    "<p>Prices of last year.</p>",
  );
  items.set("T-OLD", {
    ...(items.get("T-OLD") as Item),
    deletedAt: "2026-11-01T10:00:00.000Z",
    deletedBy: "ben@example.com",
  });
}

if (FREIGHT) seedFreight();
else seedDefault();

interface DevGrant {
  readonly id: string;
  readonly folderId: string;
  readonly principalType: string;
  readonly principalKey: string;
  readonly level: string;
}

const grants: DevGrant[] = [
  {
    id: "G-1",
    folderId: "F-SALES",
    principalType: "group",
    principalKey: "sales@example.com",
    level: "edit",
  },
  {
    id: "G-2",
    folderId: "F-QUOTES",
    principalType: "ou",
    principalKey: "/field",
    level: "use",
  },
];

const MEMBERSHIPS = {
  resolver: "groupsapp_direct",
  nested: false,
  refreshedAt: NOW,
  groups: [
    { group: "admins@example.com", members: 3, childGroups: [], status: "ok" },
    {
      group: "sales@example.com",
      members: 28,
      childGroups: ["emea-sales@example.com"],
      status: "ok",
    },
  ],
  warnings: [],
};

/** 60 audit events of 2026-11, newest first after sorting, so the Audit log has 2 pages. */
const AUDIT = Array.from({ length: 60 }, (_, n) => ({
  id: `E-${String(n).padStart(3, "0")}`,
  ts: new Date(Date.parse(NOW) - n * 3600000).toISOString(),
  actor: n % 7 === 3 ? "ben@example.com" : ME,
  actorRoles: n % 7 === 3 ? "" : "admin",
  surface: "webapp",
  action: n % 7 === 3 ? "template.get" : "template.update",
  targetType: "template",
  targetId: "T-QUOTE",
  targetPath: "/Sales/Quotes",
  result: n % 7 === 3 ? "denied" : "ok",
  errorCode: n % 7 === 3 ? "DENIED" : "",
  durationMs: 400 + n,
  requestId: `MWARO9CA-YG9V${String(n).padStart(2, "0")}`,
  appVersion: "dev",
  before: { title: "Price quote 2025" },
  after: { title: "Price quote 2026" },
}));

const BACKUPS = ["2026-11-09", "2026-11-08", "2026-11-07"];

const settings: Record<SettingName, SettingEntry> = {
  personalTemplates: PERSONAL_OFF
    ? { value: "off", updatedAt: "", updatedBy: "" }
    : { value: "on", updatedAt: "2026-11-09T13:05:00.000Z", updatedBy: ANA },
  recipientsExternal: { value: "allow", updatedAt: "", updatedBy: "" },
};

/** `config.set` as the server answers it: VALIDATION, CONFLICT on a stale `from`, no-op on the same value. */
function configSet(args: Record<string, unknown>) {
  const name = args["name"];
  if (!isSettingName(name))
    throw new AppError(ErrorCode.VALIDATION, "Setting does not exist.");
  const entry = settings[name];
  if (entry.value === args["value"]) return { name, ...entry, changed: false };
  if (entry.value !== args["from"])
    throw new AppError(
      ErrorCode.CONFLICT,
      "Another admin changed this setting.",
      { name, ...entry },
    );
  if (!isSettingValue(name, args["value"]))
    throw new AppError(ErrorCode.VALIDATION, "Bad value.");
  settings[name] = { value: args["value"], updatedAt: NOW, updatedBy: ME };
  return { name, ...settings[name], changed: true };
}

function auditQuery(args: Record<string, unknown>) {
  const id = str(args, "id");
  if (id !== "") {
    const event = AUDIT.find((entry) => entry.id === id);
    if (event === undefined)
      throw new AppError(ErrorCode.NOT_FOUND, "This event was not found.");
    return { event };
  }
  const page = typeof args["page"] === "number" ? args["page"] : 0;
  const rows = AUDIT.filter(
    (entry) =>
      (str(args, "result") === "" || entry.result === str(args, "result")) &&
      (str(args, "action") === "" || entry.action === str(args, "action")) &&
      entry.actor.includes(str(args, "actor").toLowerCase()),
  );
  return {
    month: "2026-11",
    months: ["2026-11", "2026-10"],
    actions: ["template.get", "template.update"],
    page,
    pageSize: 50,
    total: rows.length,
    rows: rows
      .slice(page * 50, page * 50 + 50)
      .map((row) => ({ ...row, before: undefined, after: undefined })),
  };
}

function exportOp(folderId: string) {
  const scope = folderId === "" ? "library" : "folder";
  const inScope = [...items.values()].filter(
    (entry) =>
      entry.deletedAt === "" &&
      (folderId === "" || entry.folderId === folderId),
  );
  return {
    header: {
      schemaVersion: 1,
      exportedAt: NOW,
      exportedBy: ME,
      scope: {
        kind: scope,
        folderId,
        name: folderId === "" ? "" : devFolder(folderId).name,
      },
      folders: [],
      grants: [],
    },
    items: inScope.map((entry) => ({
      meta: {
        id: entry.id,
        folderId: entry.folderId,
        title: entry.title,
        subject: entry.subject,
        tags: entry.tags,
      },
      html: versions.get(entry.id)?.at(-1)?.html ?? "",
    })),
    total: inScope.length,
    next: null,
  };
}

function importOp(args: Record<string, unknown>) {
  const folderId = devFolder(str(args, "folderId")).id;
  let file: {
    schemaVersion?: unknown;
    items?: { meta?: { title?: string; subject?: string }; html?: string }[];
  };
  try {
    file = JSON.parse(str(args, "file")) as typeof file;
  } catch {
    throw new AppError(ErrorCode.VALIDATION, "The file is not valid JSON");
  }
  if (file.schemaVersion !== 1)
    throw new AppError(
      ErrorCode.VALIDATION,
      "Unsupported schema version: this app reads version 1",
    );
  const list = file.items ?? [];
  const taken = new Set(
    [...items.values()]
      .filter((e) => e.folderId === folderId)
      .map((e) => e.title),
  );
  const fresh = list.filter((entry) => !taken.has(entry.meta?.title ?? ""));
  if (args["dryRun"] !== true)
    for (const entry of fresh) {
      seq += 1;
      store(
        `T-${String(seq)}`,
        folderId,
        entry.meta?.title ?? "Imported",
        [],
        entry.html ?? "",
        ME,
        0,
        entry.meta?.subject ?? "",
      );
    }
  return {
    dryRun: args["dryRun"] === true,
    created: fresh.length,
    skipped: list.length - fresh.length,
    failed: 0,
    foldersCreated: 0,
    foldersReused: 0,
    subjectsFlattened: 0,
    lines: list
      .filter((entry) => taken.has(entry.meta?.title ?? ""))
      .map((entry) => ({
        kind: "template",
        name: entry.meta?.title ?? "",
        outcome: "skipped",
        reason: "A template with this title is already in this folder",
      })),
  };
}

function isAdmin(): boolean {
  return new URLSearchParams(window.location.search).get("admin") !== "0";
}

function liveFolders(): typeof folders {
  return folders.filter((entry) => !NO_ACCESS && entry.deletedAt === "");
}

function devFolder(id: string): (typeof folders)[number] {
  const found = liveFolders().find((entry) => entry.id === id);
  if (found === undefined)
    throw new AppError(
      ErrorCode.NOT_FOUND,
      "This folder was removed or moved.",
    );
  return found;
}

/** The folder and its ancestors, nearest first. */
function chainOf(id: string): (typeof folders)[number][] {
  const chain: (typeof folders)[number][] = [];
  let next = id;
  for (;;) {
    const parent = folders.find((f) => f.id === next);
    if (parent === undefined) return chain;
    chain.push(parent);
    next = parent.parentId;
  }
}

function pathOf(id: string): string {
  return `/${chainOf(id)
    .map((entry) => entry.name)
    .reverse()
    .join("/")}`;
}

/** Replaces a folder after a version check, like the server's `changeFolder`. */
function changeFolder(
  args: Record<string, unknown>,
  fields: Partial<(typeof folders)[number]>,
) {
  const found = devFolder(str(args, "folderId"));
  if (found.version !== num(args, "baseVersion"))
    throw new AppError(ErrorCode.CONFLICT, "Changed", {
      currentVersion: found.version,
      updatedBy: found.updatedBy,
      updatedAt: found.updatedAt,
    });
  const next = { ...found, ...fields, version: found.version + 1 };
  folders.splice(folders.indexOf(found), 1, next);
  return next;
}

function folderName(args: Record<string, unknown>): string {
  const name = str(args, "name").trim();
  if (name === "" || name.length > 80)
    throw new AppError(
      ErrorCode.VALIDATION,
      "Folder name must be 1 to 80 characters",
    );
  return name;
}

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

function live(id: string): Item {
  const found = item(id);
  if (found.deletedAt !== "")
    throw new AppError(
      ErrorCode.NOT_FOUND,
      "This template was removed or moved.",
    );
  return found;
}

/** Metadata change without a new body version, like the server's `template.move` and `template.delete`. */
function change(found: Item, fields: Partial<Item>): Item {
  const next = { ...found, ...fields, updatedAt: NOW, updatedBy: ME };
  items.set(found.id, next);
  return next;
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
  "folder.list": () => ({ folders: liveFolders() }),
  "template.list": (args) => ({
    items: [...items.values()]
      .filter((entry) => (entry.deletedAt !== "") === (args["trash"] === true))
      .filter((entry) => levelOf(entry.folderId) !== "none")
      .map((entry) => ({
        ...entry,
        level: levelOf(entry.folderId),
        folderLive: liveFolders().some((f) => f.id === entry.folderId),
        folderPath: pathOf(entry.folderId),
      })),
    favorites: [...favorites],
    recent: [FREIGHT ? "T-RATECON" : "T-DISCOUNT"],
    canPurge: isAdmin(),
  }),
  "favorite.set": (args) => {
    favorites.add(live(str(args, "id")).id);
    return { id: str(args, "id"), favorite: true };
  },
  "favorite.unset": (args) => {
    favorites.delete(str(args, "id"));
    return { id: str(args, "id"), favorite: false };
  },
  "search.body": (args) => {
    const words = str(args, "query").toLowerCase().split(/\s+/);
    const ids = [...items.values()]
      .filter((entry) => entry.deletedAt === "")
      .filter((entry) => {
        const text = (versions.get(entry.id)?.at(-1)?.html ?? "").toLowerCase();
        return words.every((word) => text.includes(word));
      })
      .map((entry) => entry.id);
    return { ids, skipped: 0 };
  },
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
      ME,
      0,
      str(args, "subject"),
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
      ME,
      0,
      str(args, "subject"),
    );
  },
  "template.duplicate": (args) => {
    const found = live(str(args, "id"));
    needLevel(found.folderId, "edit");
    seq += 1;
    return store(
      `T-${String(seq)}`,
      found.folderId,
      `Copy of ${found.title}`,
      [...found.tags],
      versions.get(found.id)?.at(-1)?.html ?? "",
      ME,
      0,
      found.subject,
    );
  },
  "template.move": (args) => {
    const found = live(str(args, "id"));
    const folderId = str(args, "folderId");
    needLevel(found.folderId, "edit");
    needLevel(folderId, "edit");
    checkBase(found, num(args, "baseVersion"));
    return change(found, { folderId });
  },
  "template.delete": (args) => {
    const found = live(str(args, "id"));
    needLevel(found.folderId, "edit");
    checkBase(found, num(args, "baseVersion"));
    return change(found, { deletedAt: NOW, deletedBy: ME });
  },
  "admin.folders": () => ({
    isAdmin: isAdmin(),
    folders: liveFolders()
      .filter((entry) => isAdmin() || entry.level === "manage")
      .map((entry) => ({ ...entry, level: "manage" })),
  }),
  "folder.create": (args) => {
    seq += 1;
    const created = {
      ...folder(
        `F-${String(seq)}`,
        folderName(args),
        str(args, "parentId"),
        "manage",
      ),
    };
    folders.push(created);
    return created;
  },
  "folder.rename": (args) => changeFolder(args, { name: folderName(args) }),
  "folder.move": (args) =>
    changeFolder(args, { parentId: str(args, "parentId") }),
  "folder.delete": (args) => {
    const id = str(args, "folderId");
    const busy =
      folders.some((entry) => entry.parentId === id) ||
      [...items.values()].some(
        (entry) => entry.folderId === id && entry.deletedAt === "",
      );
    if (busy)
      throw new AppError(
        ErrorCode.VALIDATION,
        "Only an empty folder can be deleted",
      );
    return changeFolder(args, { deletedAt: NOW, deletedBy: ME });
  },
  "grant.list": (args) => {
    const id = str(args, "folderId");
    return {
      grants: chainOf(id).flatMap(({ id: folderId }) =>
        grants
          .filter((entry) => entry.folderId === folderId)
          .map((entry) => ({
            ...entry,
            active: entry.principalType !== "ou",
            inherited: folderId !== id,
            sourcePath: pathOf(folderId),
          })),
      ),
    };
  },
  "grant.add": (args) => {
    const key = str(args, "principalKey").trim().toLowerCase();
    if (str(args, "principalType") === "group" && key.startsWith("missing"))
      throw new AppError(
        ErrorCode.VALIDATION,
        `Group ${key} was not found or its members are not visible`,
      );
    seq += 1;
    const added = {
      id: `G-${String(seq)}`,
      folderId: devFolder(str(args, "folderId")).id,
      principalType: str(args, "principalType"),
      principalKey: key,
      level: str(args, "level"),
    };
    grants.push(added);
    return added;
  },
  "grant.remove": (args) => {
    const index = grants.findIndex(
      (entry) => entry.id === str(args, "grantId"),
    );
    if (index < 0)
      throw new AppError(
        ErrorCode.NOT_FOUND,
        "This grant was removed or moved.",
      );
    grants.splice(index, 1);
    return { removed: str(args, "grantId") };
  },
  "audit.query": auditQuery,
  "usage.report": () => ({
    since: "2026-10-11",
    rows: [...items.values()]
      .filter((entry) => entry.deletedAt === "")
      .map((entry, n) => ({
        id: entry.id,
        title: entry.title,
        folderPath: pathOf(entry.folderId),
        applies30d: n === 0 ? 112 : 0,
        lastUsedAt: n === 0 ? NOW : "",
      })),
  }),
  "export.folder": (args) => exportOp(str(args, "folderId")),
  "export.library": () => exportOp(""),
  import: importOp,
  "config.set": configSet,
  "config.get": () => ({
    settings,
    domain: "example.com",
    adminGroup: "admins@example.com",
    resolver: "groupsapp_direct",
    callerIdentity: "active_user",
    indexRev: "42",
    appVersion: "dev",
    indexBytes: 870400,
    indexWarnBytes: 3 * 1024 * 1024,
    jobs: [
      {
        name: "tick",
        schedule: "every 5 min",
        lastOk: NOW,
        status: "ok",
        lastError: "",
      },
      {
        name: "refreshMembers",
        schedule: "every 15 min",
        lastOk: "2026-11-09T10:00:00.000Z",
        status: "late",
        lastError: "2026-11-09T10:15:00.000Z Error: GroupsApp unavailable",
      },
      {
        name: "daily",
        schedule: "daily, 02:00 to 03:00",
        lastOk: "2026-11-09T02:01:00.000Z",
        status: "ok",
        lastError: "",
      },
    ],
    triggersError: "",
  }),
  "backup.list": () => ({ dates: BACKUPS }),
  "backup.restore": (args) => {
    if (!BACKUPS.includes(str(args, "date")))
      throw new AppError(ErrorCode.NOT_FOUND, "This backup was removed.");
    return { date: str(args, "date"), rev: 43 };
  },
  "membership.status": () => MEMBERSHIPS,
  "membership.refresh": () => ({ ...MEMBERSHIPS, refreshedAt: NOW }),
  "template.restoreFromTrash": (args) => {
    const found = item(str(args, "id"));
    const folderId = str(args, "folderId") || found.folderId;
    devFolder(folderId);
    needLevel(folderId, "edit");
    return change(found, { folderId, deletedAt: "", deletedBy: "" });
  },
  "trash.purge": () => {
    const gone = [...items.values()].filter((entry) => entry.deletedAt !== "");
    for (const entry of gone) items.delete(entry.id);
    // Like the server, deleted folders leave too and count in `purged`.
    const goneFolders = folders.filter((entry) => entry.deletedAt !== "");
    folders.splice(0, folders.length, ...liveFolders());
    // `?pending=<n>` shows the message for templates whose files wait for the daily job.
    const pending = Number(
      new URLSearchParams(window.location.search).get("pending") ?? "0",
    );
    return {
      purged: gone.length + goneFolders.length,
      filesTrashed: gone.length,
      itemsPending: pending,
    };
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
    return {
      ...entry,
      prompts: scanBody(entry.html, [], entry.subject).prompts,
    };
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
      entry.subject,
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
