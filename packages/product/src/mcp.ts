import type { ProductAction } from "./action"
import type { ProductTextKey } from "./text"

export type ProductMcpAvailability = "connected" | "disabled" | "failed" | "needs_auth" | "needs_client_registration" | "unsupported"

export type ProductMcpSeverity = "none" | "warning" | "error"

export type ProductMcpActionName = "connect" | "disconnect" | "reconnect" | "authenticate"

export type ProductMcpStatusInput = {
  status: ProductMcpAvailability
  error?: string
  raw?: string
  code?: string
}

export type ProductMcpStateInput = {
  name: string
  status: ProductMcpStatusInput
  hostActions?: ProductMcpActionName[]
}

export type ProductMcpDiagnostic = {
  message: string
  raw?: string
  code?: string
  textKey: Extract<ProductTextKey, `error.mcp.${string}`>
}

export type ProductMcpState = {
  name: string
  availability: ProductMcpAvailability
  severity: ProductMcpSeverity
  action?: ProductMcpActionName
  availableActions: ProductMcpActionName[]
  diagnostic?: ProductMcpDiagnostic
}

export type ProductMcpAction = Extract<ProductAction, { type: `mcp.${string}` }>

const ACTION_ORDER: ProductMcpActionName[] = ["connect", "disconnect", "reconnect", "authenticate"]

export function deriveProductMcpState(input: ProductMcpStateInput): ProductMcpState {
  const availableActions = input.status.status === "unsupported" ? [] : normalizeActions(input.hostActions ?? ACTION_ORDER)
  const action = defaultAction(input.status.status)
  return {
    name: input.name,
    availability: input.status.status,
    severity: severityFor(input.status.status),
    ...(action && availableActions.includes(action) ? { action } : {}),
    availableActions,
    ...(input.status.error || input.status.raw || input.status.code
      ? {
          diagnostic: {
            message: input.status.error ?? diagnosticMessage(input.status.status),
            ...(input.status.raw ? { raw: input.status.raw } : {}),
            ...(input.status.code ? { code: input.status.code } : {}),
            textKey: textKeyFor(input.status.status),
          },
        }
      : {}),
  }
}

export function deriveProductMcpStates(inputs: ProductMcpStateInput[]): ProductMcpState[] {
  return inputs
    .map(deriveProductMcpState)
    .sort((left, right) => left.name.localeCompare(right.name))
}

export function deriveProductMcpAction(state: ProductMcpState): ProductMcpAction | undefined {
  if (!state.action) return
  return { type: `mcp.${state.action}`, name: state.name } as ProductMcpAction
}

function normalizeActions(actions: ProductMcpActionName[]) {
  const allowed = new Set(actions)
  return ACTION_ORDER.filter((action) => allowed.has(action))
}

function defaultAction(status: ProductMcpAvailability): ProductMcpActionName | undefined {
  if (status === "connected") return "disconnect"
  if (status === "disabled") return "connect"
  if (status === "needs_auth") return "authenticate"
  if (status === "failed" || status === "needs_client_registration") return "reconnect"
}

function severityFor(status: ProductMcpAvailability): ProductMcpSeverity {
  if (status === "needs_auth") return "warning"
  if (status === "failed" || status === "needs_client_registration" || status === "unsupported") return "error"
  return "none"
}

function diagnosticMessage(status: ProductMcpAvailability) {
  if (status === "needs_auth") return "MCP authentication required"
  if (status === "needs_client_registration") return "MCP client registration required"
  if (status === "unsupported") return "MCP is unsupported by this host"
  return "MCP connection failed"
}

function textKeyFor(status: ProductMcpAvailability): Extract<ProductTextKey, `error.mcp.${string}`> {
  if (status === "needs_auth") return "error.mcp.authentication_required"
  if (status === "needs_client_registration") return "error.mcp.client_registration_required"
  if (status === "unsupported") return "error.mcp.unsupported"
  return "error.mcp.connection_failed"
}
