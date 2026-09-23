import { deriveProductStatus } from "./interaction"
import { createProductSessionMutationState, type ProductSessionMutationState } from "./session-mutation"
import type { ProductError, ProductRunState, ProductSnapshot } from "./snapshot"

export type ProductSessionInput = {
  id: string
  title?: string
  createdAt?: number
  updatedAt: number
  parentID?: string
  archivedAt?: number
  status?: ProductRunState | string
  available?: boolean
  tags?: string[]
}

export type ProductSessionSummary = {
  id: string
  title: string
  shortID: string
  createdAt?: number
  updatedAt: number
  status: ProductRunState
  active: boolean
  available: boolean
  tags: string[]
}

export type ProductSessionListStatus = "loading" | "ready" | "empty" | "error"

export type ProductSessionList = {
  status: ProductSessionListStatus
  items: ProductSessionSummary[]
  activeSessionID?: string
  selectedSessionID?: string
  switchingSessionID?: string
  availableTags: string[]
  error?: ProductError
}

export type ProductSessionState = {
  activeSessionID?: string
  switchingSessionID?: string
  snapshots: Record<string, ProductSnapshot>
  mutation: ProductSessionMutationState
}

export function deriveProductSessionList(input: {
  sessions: ProductSessionInput[]
  activeSessionID?: string
  selectedSessionID?: string
  switchingSessionID?: string
  query?: string
  includeActive?: boolean
  loading?: boolean
  error?: ProductError
}): ProductSessionList {
  const sessions = [...new Map(input.sessions
    .filter((session) => !session.parentID && !session.archivedAt)
    .map((session) => [session.id, session])).values()]
    .map((session): ProductSessionSummary => ({
      id: session.id,
      title: session.title?.trim() || session.id.slice(0, 8),
      shortID: session.id.slice(0, 8),
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      status: deriveProductStatus(session.status),
      active: session.id === input.activeSessionID,
      available: session.available !== false,
      tags: [...new Set((session.tags ?? []).map((tag) => tag.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    }))
    .sort((left, right) => right.updatedAt - left.updatedAt || left.id.localeCompare(right.id))
  const availableTags = [...new Set(sessions.flatMap((session) => session.tags))].sort((a, b) => a.localeCompare(b))
  const query = input.query?.trim().toLowerCase()
  const items = sessions
    .filter((session) => input.includeActive !== false || !session.active)
    .filter((session) => !query || [session.title, session.shortID, session.id, ...session.tags].join(" ").toLowerCase().includes(query))
  const selected = items.find((session) => session.id === input.selectedSessionID && session.available)
    ?? items.find((session) => session.id === input.activeSessionID && session.available)
    ?? items.find((session) => session.available)
  const switching = items.find((session) => session.id === input.switchingSessionID && session.available)

  return {
    status: input.error ? "error" : input.loading ? "loading" : items.length > 0 ? "ready" : "empty",
    items,
    activeSessionID: input.activeSessionID,
    selectedSessionID: selected?.id,
    switchingSessionID: switching && switching.id !== input.activeSessionID ? switching.id : undefined,
    availableTags,
    ...(input.error ? { error: input.error } : {}),
  }
}

export function deriveProductSessionSwitch(input: {
  sessions: Array<Pick<ProductSessionSummary, "id" | "available">>
  currentSessionID?: string
  targetSessionID: string
}) {
  if (input.targetSessionID === input.currentSessionID) return
  const target = input.sessions.find((session) => session.id === input.targetSessionID)
  if (!target?.available) return
  return { sessionID: target.id }
}

export function createProductSessionState(activeSessionID?: string): ProductSessionState {
  return {
    activeSessionID,
    snapshots: {},
    mutation: createProductSessionMutationState(),
  }
}

export function rememberProductSessionSnapshot(state: ProductSessionState, sessionID: string, snapshot: ProductSnapshot): ProductSessionState {
  return {
    ...state,
    snapshots: {
      ...state.snapshots,
      [sessionID]: snapshot,
    },
  }
}

export function beginProductSessionSwitch(state: ProductSessionState, sessionID: string): ProductSessionState {
  if (sessionID === state.activeSessionID) return state
  return {
    ...state,
    switchingSessionID: sessionID,
  }
}

export function activateProductSession(state: ProductSessionState, sessionID: string, snapshot?: ProductSnapshot): ProductSessionState {
  const next = {
    ...state,
    activeSessionID: sessionID,
    snapshots: snapshot
      ? {
          ...state.snapshots,
          [sessionID]: snapshot,
        }
      : state.snapshots,
  }
  delete next.switchingSessionID
  return next
}
