import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";

/** Apps Script globals. Pure code in src/shared must not touch the platform (ADR-0005). */
const APPS_SCRIPT_GLOBALS = [
  "AdminDirectory",
  "Browser",
  "CacheService",
  "CalendarApp",
  "CardService",
  "Charts",
  "ConferenceDataService",
  "ContactsApp",
  "ContentService",
  "DataStudioApp",
  "DocumentApp",
  "Drive",
  "DriveApp",
  "FormApp",
  "GmailApp",
  "GroupsApp",
  "HtmlService",
  "Jdbc",
  "LanguageApp",
  "LockService",
  "Logger",
  "MailApp",
  "Maps",
  "PropertiesService",
  "ScriptApp",
  "Session",
  "SlidesApp",
  "SpreadsheetApp",
  "UrlFetchApp",
  "Utilities",
  "XmlService",
  "google",
];

/** Bans imports whose path has a segment named one of `segments`, for example `../server` or `../../server/x`. */
const restrictedSegments = (segments, message) => [
  "error",
  {
    patterns: [
      {
        group: segments.flatMap((segment) => [
          `**/${segment}`,
          `**/${segment}/**`,
        ]),
        message,
      },
    ],
  },
];

const restrictedGlobals = (names, reason) =>
  names.map((name) => ({ name, message: `${name}: ${reason}` }));

export default defineConfig(
  {
    ignores: ["dist/", "coverage/", "node_modules/", "docs/", ".claude/"],
  },
  {
    files: ["**/*.ts"],
    extends: [tseslint.configs.strictTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ["**/*.mjs"],
    extends: [tseslint.configs.strict],
  },
  {
    files: ["src/shared/**/*.ts"],
    rules: {
      "no-restricted-globals": [
        "error",
        ...restrictedGlobals(
          APPS_SCRIPT_GLOBALS,
          "src/shared is pure TypeScript; pass platform services in from src/server or src/addon.",
        ),
      ],
      "no-restricted-imports": restrictedSegments(
        ["server", "addon"],
        "Shared code imports neither side.",
      ),
    },
  },
  {
    // ADR-0003 Part A: add-on code runs as the user and never reads storage or shared stores.
    files: ["src/addon/**/*.ts"],
    rules: {
      "no-restricted-imports": restrictedSegments(
        ["server"],
        "Add-on code must not import server code (ADR-0003 Part A).",
      ),
      "no-restricted-globals": [
        "error",
        ...restrictedGlobals(
          ["Drive", "DriveApp", "GroupsApp", "AdminDirectory"],
          "add-on code has no storage or membership access (ADR-0003 Part A).",
        ),
      ],
      "no-restricted-properties": [
        "error",
        {
          object: "CacheService",
          property: "getScriptCache",
          message: "Add-on code uses the User Cache only (ADR-0003 Part A).",
        },
        {
          object: "PropertiesService",
          property: "getScriptProperties",
          message:
            "Add-on code never reads Script Properties (ADR-0003 Part A).",
        },
      ],
    },
  },
  {
    // The browser reaches the server only through google.script.run.rpc (ADR-0003 Part A).
    files: ["src/web/**/*.ts"],
    rules: {
      "no-restricted-imports": restrictedSegments(
        ["server", "addon"],
        "Web code calls the server through rpc only.",
      ),
    },
  },
  {
    files: ["src/server/**/*.ts"],
    rules: {
      "no-restricted-properties": [
        "error",
        {
          object: "CacheService",
          property: "getUserCache",
          message:
            "Server code runs as the owner; the User Cache would be shared by every caller.",
        },
      ],
      "no-restricted-imports": restrictedSegments(
        ["addon"],
        "Server code must not import add-on code (ADR-0003 Part A).",
      ),
    },
  },
);
