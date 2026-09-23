import { beginProductSessionMutation, completeProductSessionMutation, failProductSessionMutation, hydrateProductMutableSessions, type ProductSessionMutationState } from "@opencode-ai/product"
import type { VsCodeSessionMutationEvent } from "../../../product/session-mutation"

export { toVsCodeMutableSession, toVsCodeSessionMutationTarget } from "../../../product/session-mutation"

export function reduceVsCodeSessionMutation(
  state: ProductSessionMutationState,
  event: VsCodeSessionMutationEvent,
): ProductSessionMutationState {
  if (event.type === "success") return completeProductSessionMutation(state, event.result)
  if (event.type === "failure") return failProductSessionMutation(state, event.failure)
  const hydrated = hydrateProductMutableSessions(state, [event.session])
  const pending = beginProductSessionMutation(hydrated, event.action)
  return pending.ok ? pending.state : hydrated
}
