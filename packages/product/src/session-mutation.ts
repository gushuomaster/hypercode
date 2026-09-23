import type { ProductSessionMutationAction } from "./action"
import type { ProductError } from "./snapshot"
import type { ProductTextKey } from "./text"

export type ProductSessionMutationKind = "rename" | "archive" | "share" | "unshare" | "tag.add" | "tag.remove"

export type ProductSessionMutationCapabilities = {
  rename: boolean
  archive: boolean
  share: boolean
  unshare: boolean
  tags: boolean
}

export type ProductMutableSessionInput = {
  id: string
  title: string
  archivedAt?: number
  shareURL?: string
  tags?: string[]
  available?: boolean
  capabilities: ProductSessionMutationCapabilities
}

export type ProductMutableSession = {
  id: string
  title: string
  archivedAt?: number
  shareURL?: string
  tags: string[]
  available: boolean
  capabilities: ProductSessionMutationCapabilities
}

export type ProductSessionMutationErrorCode =
  | "not_found"
  | "unsupported"
  | "unavailable"
  | "already_archived"
  | "already_shared"
  | "not_shared"
  | "invalid_title"
  | "invalid_tag"
  | "duplicate_tag"
  | "missing_tag"
  | "pending"
  | "permission_denied"
  | "request_failed"
  | "unknown"

export type ProductSessionMutationError = Omit<ProductError, "code"> & {
  code: ProductSessionMutationErrorCode
  diagnosticCode?: string
  textKey: ProductTextKey
}

export type ProductSessionMutationStatus =
  | { state: "idle" }
  | { state: "pending"; action: ProductSessionMutationAction }
  | { state: "success"; action: ProductSessionMutationAction }
  | { state: "error"; action: ProductSessionMutationAction; error: ProductSessionMutationError }

export type ProductSessionMutationState = {
  sessions: Record<string, ProductMutableSession>
  mutations: Record<string, Partial<Record<ProductSessionMutationKind, Exclude<ProductSessionMutationStatus, { state: "idle" }>>>>
}

export type ProductSessionMutationUnavailableReason = Exclude<ProductSessionMutationErrorCode, "permission_denied" | "request_failed" | "unknown">

export type ProductSessionMutationAvailability =
  | { available: true }
  | { available: false; reason: ProductSessionMutationUnavailableReason }

export type ProductSessionMutationResult =
  | { type: "session.rename"; sessionID: string; title: string }
  | { type: "session.archive"; sessionID: string; archivedAt: number }
  | { type: "session.share"; sessionID: string; shareURL: string }
  | { type: "session.unshare"; sessionID: string }
  | { type: "session.tag.add" | "session.tag.remove"; sessionID: string; tags: string[] }

export type ProductSessionMutationIntent =
  | { type: "session.rename"; sessionID: string; title: string }
  | { type: "session.archive"; sessionID: string }
  | { type: "session.share"; sessionID: string }
  | { type: "session.unshare"; sessionID: string }
  | { type: "session.tag.add" | "session.tag.remove"; sessionID: string; tag: string; tags: string[] }

export type ProductSessionMutationFailure = {
  type: ProductSessionMutationAction["type"]
  sessionID: string
  error: {
    code?: string
    message: string
    raw?: string
  }
}

export function createProductSessionMutationState(): ProductSessionMutationState {
  return {
    sessions: {},
    mutations: {},
  }
}

export function hydrateProductMutableSessions(
  state: ProductSessionMutationState,
  sessions: ProductMutableSessionInput[],
): ProductSessionMutationState {
  return {
    ...state,
    sessions: {
      ...state.sessions,
      ...Object.fromEntries(sessions.map((session) => [session.id, normalizeSession(session)])),
    },
  }
}

export function deriveProductSessionMutationStatus(
  state: ProductSessionMutationState,
  sessionID: string,
  kind: ProductSessionMutationKind,
): ProductSessionMutationStatus {
  return state.mutations[sessionID]?.[kind] ?? { state: "idle" }
}

export function deriveProductSessionMutationAvailability(
  state: ProductSessionMutationState,
  action: ProductSessionMutationAction,
): ProductSessionMutationAvailability {
  const session = state.sessions[action.sessionID]
  if (!session) return { available: false, reason: "not_found" }
  if (!session.available) return { available: false, reason: "unavailable" }
  if (!supports(session.capabilities, action)) return { available: false, reason: "unsupported" }
  if (deriveProductSessionMutationStatus(state, action.sessionID, mutationKind(action)).state === "pending") {
    return { available: false, reason: "pending" }
  }
  if (action.type === "session.rename") {
    const title = action.title.trim()
    if (!title) return { available: false, reason: "invalid_title" }
    if (title === session.title) return { available: false, reason: "unavailable" }
  }
  if (action.type === "session.archive" && session.archivedAt !== undefined) return { available: false, reason: "already_archived" }
  if (action.type === "session.share" && session.shareURL) return { available: false, reason: "already_shared" }
  if (action.type === "session.unshare" && !session.shareURL) return { available: false, reason: "not_shared" }
  if (action.type === "session.tag.add" || action.type === "session.tag.remove") {
    const tag = action.tag.trim()
    if (!tag) return { available: false, reason: "invalid_tag" }
    if (action.type === "session.tag.add" && session.tags.includes(tag)) return { available: false, reason: "duplicate_tag" }
    if (action.type === "session.tag.remove" && !session.tags.includes(tag)) return { available: false, reason: "missing_tag" }
  }
  return { available: true }
}

export function beginProductSessionMutation(
  state: ProductSessionMutationState,
  action: ProductSessionMutationAction,
):
  | { ok: true; state: ProductSessionMutationState; intent: ProductSessionMutationIntent }
  | { ok: false; state: ProductSessionMutationState; reason: ProductSessionMutationUnavailableReason } {
  const availability = deriveProductSessionMutationAvailability(state, action)
  if (!availability.available) return { ok: false, state, reason: availability.reason }
  return {
    ok: true,
    state: setMutation(state, action.sessionID, mutationKind(action), { state: "pending", action }),
    intent: mutationIntent(state.sessions[action.sessionID]!, action),
  }
}

export function completeProductSessionMutation(
  state: ProductSessionMutationState,
  result: ProductSessionMutationResult,
): ProductSessionMutationState {
  const kind = mutationKind(result)
  const status = deriveProductSessionMutationStatus(state, result.sessionID, kind)
  const session = state.sessions[result.sessionID]
  if (status.state !== "pending" || !session) return state
  if (result.type === "session.rename" && !result.title.trim()) {
    return failProductSessionMutation(state, {
      type: result.type,
      sessionID: result.sessionID,
      error: { code: "invalid_title", message: "Invalid session title" },
    })
  }
  if (result.type === "session.share" && !result.shareURL.trim()) {
    return failProductSessionMutation(state, {
      type: result.type,
      sessionID: result.sessionID,
      error: { code: "request_failed", message: "Missing share URL" },
    })
  }

  const next = { ...session }
  if (result.type === "session.rename") next.title = result.title.trim()
  if (result.type === "session.archive") next.archivedAt = result.archivedAt
  if (result.type === "session.share") next.shareURL = result.shareURL.trim()
  if (result.type === "session.unshare") delete next.shareURL
  if (result.type === "session.tag.add" || result.type === "session.tag.remove") next.tags = normalizeTags(result.tags)

  return setMutation({
    ...state,
    sessions: {
      ...state.sessions,
      [result.sessionID]: next,
    },
  }, result.sessionID, kind, { state: "success", action: status.action })
}

export function failProductSessionMutation(
  state: ProductSessionMutationState,
  failure: ProductSessionMutationFailure,
): ProductSessionMutationState {
  const kind = mutationKind(failure)
  const status = deriveProductSessionMutationStatus(state, failure.sessionID, kind)
  if (status.state !== "pending") return state
  return setMutation(state, failure.sessionID, kind, {
    state: "error",
    action: status.action,
    error: normalizeProductSessionMutationError(failure.error),
  })
}

export function normalizeProductSessionMutationError(error: {
  code?: string
  message: string
  raw?: string
}): ProductSessionMutationError {
  const diagnostic = [error.code, error.message, error.raw].filter(Boolean).join(" ")
  const code = mutationErrorCode(diagnostic)
  return {
    code,
    ...(error.code && error.code !== code ? { diagnosticCode: error.code } : {}),
    message: error.message,
    raw: error.raw ?? error.message,
    textKey: mutationErrorTextKey(code),
  }
}

function normalizeSession(session: ProductMutableSessionInput): ProductMutableSession {
  return {
    id: session.id,
    title: session.title.trim() || session.id.slice(0, 8),
    ...(session.archivedAt === undefined ? {} : { archivedAt: session.archivedAt }),
    ...(session.shareURL?.trim() ? { shareURL: session.shareURL.trim() } : {}),
    tags: normalizeTags(session.tags ?? []),
    available: session.available !== false,
    capabilities: { ...session.capabilities },
  }
}

function normalizeTags(tags: string[]) {
  return [...new Set(tags.map((tag) => tag.trim()).filter(Boolean))].sort((left, right) => left.localeCompare(right))
}

function supports(capabilities: ProductSessionMutationCapabilities, action: ProductSessionMutationAction) {
  if (action.type === "session.rename") return capabilities.rename
  if (action.type === "session.archive") return capabilities.archive
  if (action.type === "session.share") return capabilities.share
  if (action.type === "session.unshare") return capabilities.unshare
  return capabilities.tags
}

function mutationIntent(session: ProductMutableSession, action: ProductSessionMutationAction): ProductSessionMutationIntent {
  if (action.type === "session.rename") return { ...action, title: action.title.trim() }
  if (action.type === "session.tag.add") {
    const tag = action.tag.trim()
    return { ...action, tag, tags: normalizeTags([...session.tags, tag]) }
  }
  if (action.type === "session.tag.remove") {
    const tag = action.tag.trim()
    return { ...action, tag, tags: session.tags.filter((item) => item !== tag) }
  }
  return action
}

function mutationKind(action: Pick<ProductSessionMutationAction, "type">): ProductSessionMutationKind {
  if (action.type === "session.rename") return "rename"
  if (action.type === "session.archive") return "archive"
  if (action.type === "session.share") return "share"
  if (action.type === "session.unshare") return "unshare"
  if (action.type === "session.tag.add") return "tag.add"
  return "tag.remove"
}

function setMutation(
  state: ProductSessionMutationState,
  sessionID: string,
  kind: ProductSessionMutationKind,
  status: Exclude<ProductSessionMutationStatus, { state: "idle" }>,
): ProductSessionMutationState {
  return {
    ...state,
    mutations: {
      ...state.mutations,
      [sessionID]: {
        ...state.mutations[sessionID],
        [kind]: status,
      },
    },
  }
}

function mutationErrorCode(diagnostic: string): ProductSessionMutationErrorCode {
  if (/not[_ -]?found|\b404\b/i.test(diagnostic)) return "not_found"
  if (/not[_ -]?implemented|unsupported/i.test(diagnostic)) return "unsupported"
  if (/permission|forbidden|unauthorized|\b401\b|\b403\b/i.test(diagnostic)) return "permission_denied"
  if (/already[_ -]?archived/i.test(diagnostic)) return "already_archived"
  if (/already[_ -]?shared/i.test(diagnostic)) return "already_shared"
  if (/invalid[_ -]?title/i.test(diagnostic)) return "invalid_title"
  if (/unknown/i.test(diagnostic)) return "unknown"
  return "request_failed"
}

function mutationErrorTextKey(code: ProductSessionMutationErrorCode): ProductTextKey {
  if (code === "not_found") return "error.session.not_found"
  if (code === "unsupported") return "error.session.unsupported"
  if (code === "permission_denied") return "error.session.permission_denied"
  if (code === "already_archived") return "error.session.already_archived"
  if (code === "already_shared") return "error.session.already_shared"
  if (code === "invalid_title") return "error.session.invalid_title"
  if (code === "unknown") return "error.session.unknown"
  return "error.session.request_failed"
}
