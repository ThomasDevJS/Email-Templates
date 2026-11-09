/** Constants injected by scripts/build.mjs from deploy/<env>.json and git (ADR-0005 Build). */
declare const __APP_ENV__: string;
declare const __EXEC_URL__: string;
declare const __GIT_SHA__: string;

export interface BuildInfo {
  readonly env: string;
  readonly execUrl: string;
  readonly gitSha: string;
}

export const BUILD_INFO: BuildInfo = {
  env: __APP_ENV__,
  execUrl: __EXEC_URL__,
  gitSha: __GIT_SHA__,
};

/** Version string sent as `serverVersion` and `clientVersion`, for example `dev-1a2b3c4`. */
export const APP_VERSION = `${BUILD_INFO.env}-${BUILD_INFO.gitSha}`;
