import type { ProductMcpStateInput } from "../../src/mcp"

export const mcpStateFixture: ProductMcpStateInput[] = [
  { name: "zeta", status: { status: "failed", error: "connection refused", raw: "MCPFailed: zeta" } },
  { name: "docs", status: { status: "needs_auth" } },
  { name: "local", status: { status: "connected" } },
  { name: "disabled", status: { status: "disabled" } },
  { name: "registration", status: { status: "needs_client_registration", error: "register client" } },
]
