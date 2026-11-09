// Process and file helpers shared by build, deploy, rollback and setup-check. No credentials are read here:
// clasp reads its own OAuth file from the owner's home directory.
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseDeployConfig } from "./lib/deployConfig.mjs";

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const DIST = join(ROOT, "dist");
const CLASP_BIN = join(ROOT, "node_modules", ".bin", "clasp");

export function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

export function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

export function fail(message) {
  console.error(`ERROR: ${message}`);
  process.exit(1);
}

/** Runs a command with inherited output. Throws on a non-zero exit. */
export function run(command, args) {
  const result = spawnSync(command, args, { cwd: ROOT, stdio: "inherit" });
  if (result.status !== 0)
    throw new Error(
      `${command} ${args.join(" ")} exited with ${String(result.status)}`,
    );
}

/** Runs a command and returns its trimmed stdout. Throws on a non-zero exit; stderr passes through. */
export function capture(command, args) {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  });
  if (result.status !== 0)
    throw new Error(
      `${command} ${args.join(" ")} exited with ${String(result.status)}`,
    );
  return result.stdout.trim();
}

export function gitShortSha() {
  return capture("git", ["rev-parse", "--short", "HEAD"]);
}

export function gitIsDirty() {
  return capture("git", ["status", "--porcelain"]) !== "";
}

export function gitBranch() {
  return capture("git", ["rev-parse", "--abbrev-ref", "HEAD"]);
}

export function hasClasp() {
  return existsSync(CLASP_BIN);
}

export function clasp(args) {
  run(CLASP_BIN, args);
}

export function claspJson(args) {
  return capture(CLASP_BIN, ["--json", ...args]);
}

export function deployConfigPath(env) {
  return join(ROOT, "deploy", `${env}.json`);
}

export function loadDeployConfig(env) {
  return parseDeployConfig(readJson(deployConfigPath(env)));
}

/** Writes a .clasp.json for `scriptId` into a fresh temp directory, for clasp calls that need no local files. */
export function tempProject(scriptId) {
  const dir = mkdtempSync(join(tmpdir(), "migway-clasp-"));
  writeJson(join(dir, ".clasp.json"), { scriptId, rootDir: "." });
  return dir;
}
