import type { HandlerContext } from "../dispatch/context";
import { mutateIndex, type Mutation } from "../storage/writer";

/**
 * Index write for a request: takes the lock, re-runs the op's authorization on the index read inside the lock
 * (a concurrent move answers CONFLICT), then applies the mutation. Every write handler commits through here.
 */
export function commit<T>(context: HandlerContext, mutation: Mutation<T>): T {
  return mutateIndex(context.services, (current) => {
    context.recheck(current);
    return mutation(current);
  });
}
