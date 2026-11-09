import { BUILD_INFO } from "../../shared/buildInfo";

export interface Caller {
  readonly email: string;
}

export interface HandlerContext {
  readonly caller: Caller;
  readonly args: unknown;
}

export type Handler = (context: HandlerContext) => unknown;

export type HandlerTable = Readonly<Record<string, Handler>>;

/** Echoes the caller email the server identified, so the slice 1 smoke test shows what `getActiveUser` returned. */
function ping({ caller }: HandlerContext): {
  pong: true;
  caller: string;
  env: string;
} {
  return { pong: true, caller: caller.email, env: BUILD_INFO.env };
}

/** Op table. Every key needs a row in POLICY (policy completeness test). */
export const HANDLERS: HandlerTable = {
  ping,
};
