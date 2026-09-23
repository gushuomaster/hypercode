export type ProductSessionNavigationNode = {
  id: string
  parentID?: string
  title?: string
  archivedAt?: number
  available?: boolean
  order?: number
}

export type ProductSessionNavigationInput = {
  currentSessionID: string
  activeChildID?: string
  nodes: ProductSessionNavigationNode[]
}

export type ProductSubagentAction =
  | { type: "subagent.open"; sessionID: string }
  | { type: "subagent.back"; sessionID: string }
  | { type: "subagent.sibling"; sessionID: string; direction: "previous" | "next" }
  | { type: "subagent.select"; sessionID: string; targetSessionID: string }

export type ProductSessionNavigation = {
  currentSessionID: string
  nodes: Record<string, ProductSessionNavigationNode>
  defaultChildID?: string
}

export type ProductSessionNavigationResult =
  | { available: true; sessionID: string }
  | { available: false; reason: "missing_current" | "missing_parent" | "missing_target" | "removed" | "archived" | "unavailable" | "no_child" | "no_sibling" }

export function deriveProductSessionNavigation(input: ProductSessionNavigationInput): ProductSessionNavigation {
  const nodes = Object.fromEntries(input.nodes.map((node) => [node.id, node]))
  const validChildren = childrenOf(nodes, input.currentSessionID).filter(isNavigable)
  const activeChild = input.activeChildID && validChildren.some((node) => node.id === input.activeChildID)
    ? input.activeChildID
    : undefined
  return {
    currentSessionID: input.currentSessionID,
    nodes,
    defaultChildID: activeChild ?? validChildren[0]?.id,
  }
}

export function resolveProductSessionNavigation(
  projection: ProductSessionNavigation,
  action: ProductSubagentAction,
): ProductSessionNavigationResult {
  const current = projection.nodes[action.sessionID]
  if (!current) return { available: false, reason: "missing_current" }
  if (current.archivedAt !== undefined) return { available: false, reason: "archived" }
  if (current.available === false) return { available: false, reason: "unavailable" }

  if (action.type === "subagent.open") {
    const target = action.sessionID === projection.currentSessionID ? projection.defaultChildID : childrenOf(projection.nodes, action.sessionID).find(isNavigable)?.id
    if (!target) return { available: false, reason: "no_child" }
    return { available: true, sessionID: target }
  }
  if (action.type === "subagent.back") {
    if (!current.parentID) return { available: false, reason: "missing_parent" }
    const parent = projection.nodes[current.parentID]
    if (!parent) return { available: false, reason: "missing_parent" }
    if (parent.archivedAt !== undefined) return { available: false, reason: "archived" }
    if (parent.available === false) return { available: false, reason: "unavailable" }
    return { available: true, sessionID: parent.id }
  }
  if (action.type === "subagent.select") {
    const target = projection.nodes[action.targetSessionID]
    if (!target) return { available: false, reason: "missing_target" }
    if (target.archivedAt !== undefined) return { available: false, reason: "archived" }
    if (target.available === false) return { available: false, reason: "unavailable" }
    if (target.parentID !== current.id) return { available: false, reason: "removed" }
    return { available: true, sessionID: target.id }
  }

  const siblings = current.parentID ? childrenOf(projection.nodes, current.parentID).filter(isNavigable) : []
  if (siblings.length < 2) return { available: false, reason: "no_sibling" }
  const index = siblings.findIndex((node) => node.id === current.id)
  const offset = action.direction === "next" ? 1 : -1
  return { available: true, sessionID: siblings[(index + offset + siblings.length) % siblings.length]!.id }
}

function childrenOf(nodes: Record<string, ProductSessionNavigationNode>, parentID: string) {
  return Object.values(nodes)
    .filter((node) => node.parentID === parentID)
    .sort((left, right) => (left.order ?? Number.MAX_SAFE_INTEGER) - (right.order ?? Number.MAX_SAFE_INTEGER) || left.id.localeCompare(right.id))
}

function isNavigable(node: ProductSessionNavigationNode) {
  return node.archivedAt === undefined && node.available !== false
}
