import {
  beginProductSessionMutation,
  completeProductSessionMutation,
  failProductSessionMutation,
  type ProductMutableSessionInput,
  type ProductSessionMutationAction,
  type ProductSessionMutationState,
  type ProductSessionMutationUnavailableReason,
} from "@opencode-ai/product"
import { errorMessage } from "../util/error"

type TuiSessionInput = {
  id: string
  title?: string
  time: {
    created: number
    updated: number
    archived?: number
  }
  share?: {
    url?: string
  }
}

export type TuiSessionMutationTarget =
  | { kind: "session.update"; input: { sessionID: string; title: string }; state: ProductSessionMutationState }
  | { kind: "session.share"; input: { sessionID: string }; state: ProductSessionMutationState }
  | { kind: "session.unshare"; input: { sessionID: string }; state: ProductSessionMutationState }
  | { kind: "unsupported"; action: ProductSessionMutationAction["type"]; reason: "unsupported"; state: ProductSessionMutationState }
  | { kind: "unavailable"; action: ProductSessionMutationAction["type"]; reason: Exclude<ProductSessionMutationUnavailableReason, "unsupported">; state: ProductSessionMutationState }

export function toTuiMutableSession(
  session: TuiSessionInput,
  capabilities: { share: boolean },
): ProductMutableSessionInput {
  return {
    id: session.id,
    title: session.title?.trim() || session.id.slice(0, 8),
    ...(session.time.archived === undefined ? {} : { archivedAt: session.time.archived }),
    ...(session.share?.url ? { shareURL: session.share.url } : {}),
    tags: [],
    available: true,
    capabilities: {
      rename: true,
      archive: false,
      share: capabilities.share,
      unshare: true,
      tags: false,
    },
  }
}

export function toTuiSessionMutationTarget(
  state: ProductSessionMutationState,
  action: ProductSessionMutationAction,
): TuiSessionMutationTarget {
  const pending = beginProductSessionMutation(state, action)
  if (!pending.ok) {
    if (pending.reason === "unsupported") {
      return { kind: "unsupported", action: action.type, reason: pending.reason, state }
    }
    return { kind: "unavailable", action: action.type, reason: pending.reason, state }
  }
  if (action.type === "session.rename") {
    return {
      kind: "session.update",
      input: { sessionID: action.sessionID, title: action.title.trim() },
      state: pending.state,
    }
  }
  if (action.type === "session.share") {
    return { kind: "session.share", input: { sessionID: action.sessionID }, state: pending.state }
  }
  if (action.type === "session.unshare") {
    return { kind: "session.unshare", input: { sessionID: action.sessionID }, state: pending.state }
  }
  return { kind: "unsupported", action: action.type, reason: "unsupported", state }
}

type ExecutableTuiSessionMutationTarget = Extract<TuiSessionMutationTarget, {
  kind: "session.update" | "session.share" | "session.unshare"
}>

export async function runTuiSessionMutation(
  target: ExecutableTuiSessionMutationTarget,
  host: {
    update: (input: Extract<ExecutableTuiSessionMutationTarget, { kind: "session.update" }>["input"]) => Promise<unknown>
    share: (input: Extract<ExecutableTuiSessionMutationTarget, { kind: "session.share" }>["input"]) => Promise<string>
    unshare: (input: Extract<ExecutableTuiSessionMutationTarget, { kind: "session.unshare" }>["input"]) => Promise<unknown>
  },
  onState: (state: ProductSessionMutationState) => void,
) {
  onState(target.state)
  try {
    const result = target.kind === "session.update"
      ? await host.update(target.input).then(() => ({ type: "session.rename" as const, ...target.input }))
      : target.kind === "session.share"
        ? await host.share(target.input).then((shareURL) => ({ type: "session.share" as const, ...target.input, shareURL }))
        : await host.unshare(target.input).then(() => ({ type: "session.unshare" as const, ...target.input }))
    const state = completeProductSessionMutation(target.state, result)
    onState(state)
    return { ok: true as const, state, result }
  } catch (error) {
    const state = failProductSessionMutation(target.state, {
      type: target.kind === "session.update" ? "session.rename" : target.kind,
      sessionID: target.input.sessionID,
      error: {
        ...(errorCode(error) ? { code: errorCode(error) } : {}),
        message: errorMessage(error),
        raw: errorMessage(error),
      },
    })
    onState(state)
    return { ok: false as const, state, error: state.mutations[target.input.sessionID] }
  }
}

function errorCode(error: unknown) {
  if (error instanceof Error && error.name && error.name !== "Error") return error.name
  if (!error || typeof error !== "object") return undefined
  if ("name" in error && typeof error.name === "string") return error.name
  if ("_tag" in error && typeof error._tag === "string") return error._tag
}
