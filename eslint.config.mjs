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
    },
  },
  {
    // ADR-0003 Part A: add-on code runs as the user and never reads storage or shared stores.
    files: ["src/addon/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/server/**", "**/server"],
              message:
                "Add-on code must not import server code (ADR-0003 Part A).",
            },
          ],
        },
      ],
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
    },
  },
);
