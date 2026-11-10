import { BUILD_INFO } from "../../shared/buildInfo";
import type { ExternalRule } from "../../shared/model/recipients";
import type { HandlerContext } from "../dispatch/context";
import { recipientPolicy } from "./body";
import { lookupProfile, type SenderProfile } from "../directory/profile";

/** Echoes the caller email the server identified (slice 1 smoke test, spike S2 evidence). */
export function ping({ caller }: HandlerContext): {
  pong: true;
  caller: string;
  env: string;
} {
  return { pong: true, caller: caller.email, env: BUILD_INFO.env };
}

/** Caller identity and admin flag, for the web app header and navigation; the recipient switch for the editor. */
export function me(context: HandlerContext): {
  email: string;
  isAdmin: boolean;
  env: string;
  recipientsExternal: ExternalRule;
} {
  return {
    email: context.caller.email,
    isAdmin: context.access().subject.isAdmin,
    env: BUILD_INFO.env,
    recipientsExternal: recipientPolicy(context.services.props).external,
  };
}

/** Sender values of the caller from the Directory (ADR-0004), for the web app header. */
export function profileMe(context: HandlerContext): SenderProfile {
  return lookupProfile(context.services, context.caller.email);
}
