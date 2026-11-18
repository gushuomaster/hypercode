import type { ProductCapabilityConfigInput } from "../../src/capability"

export type CapabilityMcpStatus = {
  status: "connected" | "disabled" | "failed" | "needs_auth" | "needs_client_registration" | "unsupported"
  error?: string
}
export type CapabilityLspStatus = { id: string; name: string; root: string; status: "connected" | "error" }
export type CapabilityFormatterStatus = { name: string; enabled: boolean; extensions: string[] }
type ExpectedSummary = { availability: string; severity: string; textKey: string }

export type CapabilityCase = {
  name: string
  config: ProductCapabilityConfigInput
  mcp: Record<string, CapabilityMcpStatus>
  lsp: CapabilityLspStatus[]
  formatter: CapabilityFormatterStatus[]
  expected: { mcp: ExpectedSummary; lsp: ExpectedSummary; formatter: ExpectedSummary; mcpItems: Record<string, string> }
}

const ts: CapabilityLspStatus = { id: "ts", name: "typescript", root: "/repo", status: "connected" }
const prettier: CapabilityFormatterStatus = { name: "prettier", enabled: true, extensions: [".ts"] }
const summary = (kind: "mcp" | "lsp" | "formatter", availability: string, severity: string, key: string): ExpectedSummary => ({
  availability,
  severity,
  textKey: `status.${kind}.${key}`,
})

// Facts -> expected Product result. TUI and VS Code parity tests iterate this same table.
export const capabilityCases: CapabilityCase[] = [
  {
    name: "no MCP server configured",
    config: { mcp: [], lsp: true, formatter: true },
    mcp: {},
    lsp: [],
    formatter: [],
    expected: {
      mcp: summary("mcp", "unconfigured", "none", "unconfigured"),
      lsp: summary("lsp", "idle", "none", "idle"),
      formatter: summary("formatter", "idle", "none", "idle"),
      mcpItems: {},
    },
  },
  {
    name: "everything configured but turned off",
    config: { mcp: [{ name: "docs", enabled: false }], lsp: false, formatter: false },
    mcp: { docs: { status: "disabled" } },
    lsp: [],
    formatter: [],
    expected: {
      mcp: summary("mcp", "disabled", "none", "disabled"),
      lsp: summary("lsp", "disabled", "none", "disabled"),
      formatter: summary("formatter", "disabled", "none", "disabled"),
      mcpItems: { docs: "item.mcp.disabled" },
    },
  },
  {
    name: "all healthy",
    config: { mcp: [{ name: "docs", enabled: true }], lsp: true, formatter: true },
    mcp: { docs: { status: "connected" } },
    lsp: [ts],
    formatter: [prettier],
    expected: {
      mcp: summary("mcp", "healthy", "none", "healthy"),
      lsp: summary("lsp", "healthy", "none", "healthy"),
      formatter: summary("formatter", "healthy", "none", "healthy"),
      mcpItems: { docs: "item.mcp.connected" },
    },
  },
  {
    name: "connection failed",
    config: { mcp: [{ name: "broken", enabled: true }], lsp: true, formatter: true },
    mcp: { broken: { status: "failed", error: "connection refused" } },
    lsp: [{ ...ts, status: "error" }],
    formatter: [prettier],
    expected: {
      mcp: summary("mcp", "failed", "error", "failed"),
      lsp: summary("lsp", "failed", "error", "failed"),
      formatter: summary("formatter", "healthy", "none", "healthy"),
      mcpItems: { broken: "item.mcp.failed" },
    },
  },
  {
    name: "authentication required",
    config: { mcp: [{ name: "docs", enabled: true }], lsp: true, formatter: true },
    mcp: { docs: { status: "needs_auth" } },
    lsp: [ts],
    formatter: [prettier],
    expected: {
      mcp: summary("mcp", "needs_attention", "warning", "needsAttention"),
      lsp: summary("lsp", "healthy", "none", "healthy"),
      formatter: summary("formatter", "healthy", "none", "healthy"),
      mcpItems: { docs: "item.mcp.needs_auth" },
    },
  },
  {
    name: "client registration required",
    config: { mcp: [{ name: "docs", enabled: true }], lsp: true, formatter: true },
    mcp: { docs: { status: "needs_client_registration", error: "register client" } },
    lsp: [ts],
    formatter: [prettier],
    expected: {
      mcp: summary("mcp", "failed", "error", "failed"),
      lsp: summary("lsp", "healthy", "none", "healthy"),
      formatter: summary("formatter", "healthy", "none", "healthy"),
      mcpItems: { docs: "item.mcp.needs_client_registration" },
    },
  },
  {
    name: "one MCP server up and one failed",
    config: { mcp: [{ name: "a", enabled: true }, { name: "b", enabled: true }], lsp: true, formatter: true },
    mcp: { a: { status: "connected" }, b: { status: "failed", error: "timeout" } },
    lsp: [ts],
    formatter: [prettier],
    expected: {
      mcp: summary("mcp", "degraded", "warning", "degraded"),
      lsp: summary("lsp", "healthy", "none", "healthy"),
      formatter: summary("formatter", "healthy", "none", "healthy"),
      mcpItems: { a: "item.mcp.connected", b: "item.mcp.failed" },
    },
  },
  {
    name: "configuration not known yet",
    config: {},
    mcp: {},
    lsp: [],
    formatter: [],
    expected: {
      mcp: summary("mcp", "unknown", "none", "unknown"),
      lsp: summary("lsp", "unknown", "none", "unknown"),
      formatter: summary("formatter", "unknown", "none", "unknown"),
      mcpItems: {},
    },
  },
]

/** Raw input in the shape the TUI receives from the SDK: Config plus per-capability status lists. */
export function toTuiSdkInput(item: CapabilityCase) {
  const known = item.config.mcp !== undefined || item.config.lsp !== undefined || item.config.formatter !== undefined
  return {
    config: known
      ? {
          mcp: item.config.mcp && Object.fromEntries(item.config.mcp.map((entry) => [entry.name, { type: "remote" as const, url: "https://example.test", enabled: entry.enabled }])),
          lsp: item.config.lsp === false ? (false as const) : {},
          formatter: item.config.formatter === false ? (false as const) : {},
        }
      : undefined,
    mcp: item.mcp,
    lsp: item.lsp,
    formatter: item.formatter,
  }
}

/** Raw input in the shape the VS Code snapshot carries: configuration facts plus the same status lists. */
export function toVsCodeSnapshotInput(item: CapabilityCase) {
  return { capabilityConfig: item.config, mcp: item.mcp, lsp: item.lsp, formatter: item.formatter }
}
