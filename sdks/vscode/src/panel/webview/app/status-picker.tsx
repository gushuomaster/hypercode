import React from "react"
import type { ProductFormatterState, ProductLspState, ProductMcpState } from "@opencode-ai/product"
import { t } from "../../../i18n"
import { formatVsCodeProductError } from "../lib/product-text-adapter"
import type { StatusItem, StatusTone } from "../lib/session-meta"

export function buildStatusPickerItems(mode: "mcp" | "system", mcp: ProductMcpState[], lsp: ProductLspState[], formatter: ProductFormatterState[]): StatusItem[] {
  const mcpItems = mcp.map((state): StatusItem => ({
    name: state.name,
    tone: state.severity === "error" ? "red" : state.severity === "warning" ? "orange" : state.availability === "connected" ? "green" : "gray",
    value: state.diagnostic ? formatVsCodeProductError(state.diagnostic) : state.availability === "connected" ? t("status.connected") : state.availability === "disabled" ? t("common.disabled") : state.availability === "needs_auth" ? t("status.needsAuthentication") : state.availability === "needs_client_registration" ? t("status.clientRegistrationRequired") : t("common.error"),
    ...(state.action ? { action: state.action, actionLabel: state.action } : {}),
  }))
  if (mode === "mcp") return mcpItems
  return [
    ...mcpItems,
    ...(lsp.length === 0 ? [{ name: "LSP", tone: "gray" as StatusTone, value: "Enabled but idle" }] : lsp.map((state): StatusItem => ({
      name: `LSP: ${state.name}`,
      tone: state.severity === "error" ? "red" : "green",
      value: state.diagnostic ? formatVsCodeProductError(state.diagnostic) : state.root,
    }))),
    ...formatter.map((state): StatusItem => ({
      name: `Formatter: ${state.name}`,
      tone: state.severity === "warning" ? "orange" : "green",
      value: state.enabled ? state.extensions.join(", ") || t("common.enabled") : t("common.disabled"),
    })),
  ]
}

export function StatusPicker({ mode, mcp, lsp, formatter, onClose }: { mode: "mcp" | "system"; mcp: ProductMcpState[]; lsp: ProductLspState[]; formatter: ProductFormatterState[]; onClose: () => void }) {
  const items = buildStatusPickerItems(mode, mcp, lsp, formatter)
  return <div className="oc-modelPicker" role="dialog" aria-label={mode === "mcp" ? "MCP status" : "System status"}>
    <div className="oc-modelPickerTop">
      <div className="oc-modelPickerHeader">
        <span className="oc-modelPickerTitle">{mode === "mcp" ? "MCP" : "Status"}</span>
        <button type="button" onClick={onClose}>Close</button>
      </div>
    </div>
    <div className="oc-modelPickerList">
      {items.map((item) => <div key={item.name} className={`oc-modelPickerItem oc-statusTone-${item.tone}`}>
        <span className="oc-modelPickerItemMain"><span className="oc-modelPickerItemLabel">{item.name}</span><span className="oc-modelPickerItemDetail">{item.value}</span></span>
      </div>)}
      {items.length === 0 ? <div className="oc-modelPickerEmptyText">No status entries</div> : null}
    </div>
  </div>
}
