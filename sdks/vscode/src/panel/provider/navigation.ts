import type { SessionSnapshot } from "../../bridge/types"
import type { PermissionRequest, QuestionRequest } from "../../core/sdk"
import { displaySessionTitle } from "../../core/session-titles"
import { cmp } from "./utils"
import { deriveProductSessionNavigation, resolveProductSessionNavigation } from "@opencode-ai/product"

type SessionInfo = NonNullable<SessionSnapshot["session"]>

export function relatedSessionMap(sessions: SessionInfo[], rootSessionID: string, sessionIDs: string[]) {
  const ids = new Set(sessionIDs)
  const map: Record<string, SessionInfo> = {}
  for (const session of sessions) {
    if (session.id === rootSessionID || session.time.archived || !ids.has(session.id)) {
      continue
    }
    map[session.id] = session
  }
  return map
}

export function subtreeSessionIds(rootID: string, sessions: SessionInfo[]) {
  const ids = [rootID]
  const queue = [rootID]

  while (queue.length > 0) {
    const parentID = queue.shift()
    if (!parentID) {
      continue
    }

    const children = sessions
      .filter((item) => isVisibleChildSession(item, parentID))
      .sort((a, b) => cmp(a.id, b.id))

    for (const child of children) {
      ids.push(child.id)
      queue.push(child.id)
    }
  }

  return ids
}

export function nav(session: SessionInfo, sessions: SessionInfo[]) {
  const projection = deriveProductSessionNavigation({
    currentSessionID: session.id,
    nodes: sessions.map((item, order) => ({
      id: item.id,
      parentID: item.parentID,
      title: item.title,
      archivedAt: item.time.archived,
      order: order,
    })),
  })
  const target = (action: Parameters<typeof resolveProductSessionNavigation>[1]) => {
    const result = resolveProductSessionNavigation(projection, action)
    if (!result.available) return undefined
    const item = sessions.find((candidate) => candidate.id === result.sessionID)
    return item ? ref(item) : undefined
  }
  return {
    firstChild: target({ type: "subagent.open", sessionID: session.id }),
    parent: target({ type: "subagent.back", sessionID: session.id }),
    prev: target({ type: "subagent.sibling", sessionID: session.id, direction: "previous" }),
    next: target({ type: "subagent.sibling", sessionID: session.id, direction: "next" }),
  }
}

export function sortRequests<T extends { id: string; sessionID: string }>(list: T[], sessionIDs: string[]) {
  const order = new Map(sessionIDs.map((item, index) => [item, index]))
  return [...list]
    .filter((item) => order.has(item.sessionID))
    .sort((a, b) => {
      const sessionCmp = (order.get(a.sessionID) ?? Number.MAX_SAFE_INTEGER) - (order.get(b.sessionID) ?? Number.MAX_SAFE_INTEGER)
      if (sessionCmp !== 0) {
        return sessionCmp
      }
      return cmp(a.id, b.id)
    })
}

export function filterPermission(list: PermissionRequest[], sessionIDs: string[]) {
  return sortRequests(list, sessionIDs)
}

export function filterQuestion(list: QuestionRequest[], sessionIDs: string[]) {
  return sortRequests(list, sessionIDs)
}

function ref(session: SessionInfo) {
  return {
    id: session.id,
    title: displaySessionTitle(session.title, session.id.slice(0, 8)),
  }
}

function isVisibleChildSession(session: SessionInfo, parentID: string) {
  return session.parentID === parentID && !session.time.archived
}
