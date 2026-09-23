import {
  beginProductSessionMutation,
  completeProductSessionMutation,
  failProductSessionMutation,
  type ProductMutableSessionInput,
  type ProductSessionMutationAction,
  type ProductSessionMutationCapabilities,
  type ProductSessionMutationFailure,
  type ProductSessionMutationResult,
  type ProductSessionMutationState,
  type ProductSessionMutationUnavailableReason,
} from "@opencode-ai/product"

type VsCodeSessionInput = {
  id: string
  title?: string
  time: {
    created?: number
    updated: number
    archived?: number
  }
  share?: {
    url?: string
  }
}

export type VsCodeSessionMutationEvent =
  | { type: "pending"; session: ProductMutableSessionInput; action: ProductSessionMutationAction }
  | { type: "success"; result: ProductSessionMutationResult }
  | { type: "failure"; failure: ProductSessionMutationFailure }

export type VsCodeSessionMutationTarget =
  | { kind: "session.update"; input: { sessionID: string; directory: string; title: string }; state: ProductSessionMutationState }
  | { kind: "session.archive"; input: { sessionID: string; directory: string }; state: ProductSessionMutationState }
  | { kind: "session.share"; input: { sessionID: string; directory: string }; state: ProductSessionMutationState }
  | { kind: "session.unshare"; input: { sessionID: string; directory: string }; state: ProductSessionMutationState }
  | { kind: "session.tags"; input: { workspaceID: string; sessionID: string; tags: string[] }; state: ProductSessionMutationState }
  | { kind: "unavailable"; action: ProductSessionMutationAction["type"]; reason: ProductSessionMutationUnavailableReason; state: ProductSessionMutationState }

export function toVsCodeMutableSession(
  session: VsCodeSessionInput,
  tags: string[],
  capabilities: ProductSessionMutationCapabilities,
): ProductMutableSessionInput {
  return {
    id: session.id,
    title: session.title?.trim() || session.id.slice(0, 8),
    ...(session.time.archived === undefined ? {} : { archivedAt: session.time.archived }),
    ...(session.share?.url ? { shareURL: session.share.url } : {}),
    tags,
    available: true,
    capabilities,
  }
}

export function toVsCodeSessionMutationTarget(
  state: ProductSessionMutationState,
  action: ProductSessionMutationAction,
  directory: string,
  workspaceID = directory,
): VsCodeSessionMutationTarget {
  const pending = beginProductSessionMutation(state, action)
  if (!pending.ok) return { kind: "unavailable", action: action.type, reason: pending.reason, state }
  if (pending.intent.type === "session.rename") {
    return {
      kind: "session.update",
      input: { sessionID: pending.intent.sessionID, directory, title: pending.intent.title },
      state: pending.state,
    }
  }
  if (pending.intent.type === "session.archive") {
    return { kind: "session.archive", input: { sessionID: pending.intent.sessionID, directory }, state: pending.state }
  }
  if (pending.intent.type === "session.share") {
    return { kind: "session.share", input: { sessionID: pending.intent.sessionID, directory }, state: pending.state }
  }
  if (pending.intent.type === "session.unshare") {
    return { kind: "session.unshare", input: { sessionID: pending.intent.sessionID, directory }, state: pending.state }
  }
  return {
    kind: "session.tags",
    input: { workspaceID, sessionID: pending.intent.sessionID, tags: pending.intent.tags },
    state: pending.state,
  }
}

export async function runVsCodeSessionMutation(
  target: Exclude<VsCodeSessionMutationTarget, { kind: "unavailable" }>,
  host: {
    update: (input: Extract<VsCodeSessionMutationTarget, { kind: "session.update" }>["input"]) => Promise<unknown>
    archive: (input: Extract<VsCodeSessionMutationTarget, { kind: "session.archive" }>["input"]) => Promise<number>
    share: (input: Extract<VsCodeSessionMutationTarget, { kind: "session.share" }>["input"]) => Promise<string>
    unshare: (input: Extract<VsCodeSessionMutationTarget, { kind: "session.unshare" }>["input"]) => Promise<unknown>
    setTags: (input: Extract<VsCodeSessionMutationTarget, { kind: "session.tags" }>["input"]) => Promise<unknown>
  },
  onEvent: (event: VsCodeSessionMutationEvent) => void | Promise<void>,
) {
  const action = pendingAction(target)
  const session = target.state.sessions[target.input.sessionID]!
  await onEvent({ type: "pending", session, action })

  try {
    const result = await executeMutation(target, action, host)
    const state = completeProductSessionMutation(target.state, result)
    await onEvent({ type: "success", result })
    return { ok: true as const, state, result }
  } catch (error) {
    const failure = {
      type: action.type,
      sessionID: action.sessionID,
      error: {
        ...(errorCode(error) ? { code: errorCode(error) } : {}),
        message: errorMessage(error),
        raw: errorMessage(error),
      },
    } satisfies ProductSessionMutationFailure
    const state = failProductSessionMutation(target.state, failure)
    await onEvent({ type: "failure", failure })
    return { ok: false as const, state, failure, error: state.mutations[action.sessionID] }
  }
}

async function executeMutation(
  target: Exclude<VsCodeSessionMutationTarget, { kind: "unavailable" }>,
  action: ProductSessionMutationAction,
  host: Parameters<typeof runVsCodeSessionMutation>[1],
): Promise<ProductSessionMutationResult> {
  if (target.kind === "session.update") {
    await host.update(target.input)
    return { type: "session.rename", sessionID: target.input.sessionID, title: target.input.title }
  }
  if (target.kind === "session.archive") {
    return { type: "session.archive", sessionID: target.input.sessionID, archivedAt: await host.archive(target.input) }
  }
  if (target.kind === "session.share") {
    return { type: "session.share", sessionID: target.input.sessionID, shareURL: await host.share(target.input) }
  }
  if (target.kind === "session.unshare") {
    await host.unshare(target.input)
    return { type: "session.unshare", sessionID: target.input.sessionID }
  }
  await host.setTags(target.input)
  if (action.type !== "session.tag.add" && action.type !== "session.tag.remove") throw new Error("Invalid tag mutation")
  return { type: action.type, sessionID: target.input.sessionID, tags: target.input.tags }
}

function pendingAction(target: Exclude<VsCodeSessionMutationTarget, { kind: "unavailable" }>) {
  const kind = target.kind === "session.update"
    ? "rename"
    : target.kind === "session.archive"
      ? "archive"
      : target.kind === "session.share"
        ? "share"
        : target.kind === "session.unshare"
          ? "unshare"
          : target.state.mutations[target.input.sessionID]?.["tag.add"]?.state === "pending"
            ? "tag.add"
            : "tag.remove"
  const status = target.state.mutations[target.input.sessionID]?.[kind]
  if (!status || status.state !== "pending") throw new Error("Session mutation target is not pending")
  return status.action
}

function errorCode(error: unknown) {
  if (error instanceof Error && error.name && error.name !== "Error") return error.name
  if (!error || typeof error !== "object") return undefined
  if ("name" in error && typeof error.name === "string") return error.name
  if ("_tag" in error && typeof error._tag === "string") return error._tag
}

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  if (typeof error === "string") return error
  return String(error)
}
