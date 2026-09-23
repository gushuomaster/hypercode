import { deriveProductSessionNavigation, resolveProductSessionNavigation, type ProductSessionNavigationNode, type ProductSubagentAction } from "@opencode-ai/product"

export function resolveVsCodeSessionNavigation(
  sessions: Array<{ id: string; parentID?: string; title?: string; available?: boolean; time?: { created?: number; updated?: number; archived?: number } }>,
  action: ProductSubagentAction,
  activeChildID?: string,
) {
  return resolveProductSessionNavigation(deriveProductSessionNavigation({
    currentSessionID: action.sessionID,
    activeChildID,
    nodes: sessions.map((session, index): ProductSessionNavigationNode => ({
      id: session.id,
      parentID: session.parentID,
      title: session.title,
      archivedAt: session.time?.archived,
      available: session.available,
      order: session.time?.updated ?? session.time?.created ?? index,
    })),
  }), action)
}
