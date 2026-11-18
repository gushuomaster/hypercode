import React from "react"
import type { ProductCapabilitySummary, ProductFormatterState, ProductLspState, ProductMcpState } from "@opencode-ai/product"
import { t } from "../../../i18n"
import { toVsCodeTextKey } from "../lib/product-text-adapter"
import { statusItemForProductFormatter, statusItemForProductLsp, statusItemForProductMcp, statusToneForProductSummary, type StatusItem } from "../lib/session-meta"

type StatusSummaries = { mcp: ProductCapabilitySummary; lsp: ProductCapabilitySummary; formatter: ProductCapabilitySummary }

// Host only renders: wording comes from Product's textKey and tone from Product's severity.
export function buildStatusPickerItems(mode: "mcp" | "system", mcp: ProductMcpState[], lsp: ProductLspState[], formatter: ProductFormatterState[], summaries: StatusSummaries): StatusItem[] {
  const mcpItems = mcp.map(statusItemForProductMcp)
  const empty = (name: string, summary: ProductCapabilitySummary): StatusItem[] => summary.availability !== "healthy"
    ? [{ name, tone: statusToneForProductSummary(summary), value: t(toVsCodeTextKey(summary.textKey)) }]
    : []
  if (mode === "mcp") return mcpItems.length ? mcpItems : empty("MCP", summaries.mcp)
  return [
    ...mcpItems,
    ...(mcpItems.length === 0 ? empty("MCP", summaries.mcp) : []),
    ...(lsp.length === 0 ? empty("LSP", summaries.lsp) : lsp.map((state): StatusItem => ({ ...statusItemForProductLsp(state), name: `LSP: ${state.name}` }))),
    ...formatter.map((state): StatusItem => ({ ...statusItemForProductFormatter(state), name: `Formatter: ${state.name}` })),
    ...(formatter.length === 0 ? empty("Formatter", summaries.formatter) : []),
  ]
}

export function StatusPicker({ mode, mcp, lsp, formatter, summaries, onClose }: { mode: "mcp" | "system"; mcp: ProductMcpState[]; lsp: ProductLspState[]; formatter: ProductFormatterState[]; summaries: StatusSummaries; onClose: () => void }) {
  const items = buildStatusPickerItems(mode, mcp, lsp, formatter, summaries)
  return <div className="oc-modelPicker" role="dialog" aria-label={t(mode === "mcp" ? "statusPicker.mcpTitle" : "statusPicker.systemTitle")}>
    <div className="oc-modelPickerTop">
      <div className="oc-modelPickerHeader">
        <span className="oc-modelPickerTitle">{mode === "mcp" ? "MCP" : t("statusPicker.systemTitle")}</span>
        <button type="button" onClick={onClose}>{t("statusPicker.close")}</button>
      </div>
    </div>
    <div className="oc-modelPickerList">
      {items.map((item) => <div key={item.name} className={`oc-modelPickerItem oc-statusTone-${item.tone}`}>
        <span className="oc-modelPickerItemMain"><span className="oc-modelPickerItemLabel">{item.name}</span><span className="oc-modelPickerItemDetail">{item.value}</span></span>
      </div>)}
      {items.length === 0 ? <div className="oc-modelPickerEmptyText">{t("statusPicker.empty")}</div> : null}
    </div>
  </div>
}
