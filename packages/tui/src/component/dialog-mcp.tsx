import { createMemo, createSignal } from "solid-js"
import { useLocal } from "../context/local"
import { useSync } from "../context/sync"
import { map, pipe, entries, sortBy } from "remeda"
import { DialogSelect, type DialogSelectRef, type DialogSelectOption } from "../ui/dialog-select"
import { useTheme } from "../context/theme"
import { TextAttributes } from "@opentui/core"
import { useSDK } from "../context/sdk"
import { translate as t } from "../context/language"
import { deriveProductMcpAction, type ProductMcpState } from "@opencode-ai/product"
import { toProductMcpStates } from "../product/mcp-adapter"

function Status(props: { state: ProductMcpState; loading: boolean }) {
  const { theme } = useTheme()
  if (props.loading) {
    return <span style={{ fg: theme.textMuted }}>⋯ {t("dialog.mcp.loading")}</span>
  }
  if (props.state.availability === "connected") {
    return <span style={{ fg: theme.success, attributes: TextAttributes.BOLD }}>✓ {t("dialog.mcp.enabled")}</span>
  }
  return <span style={{ fg: theme.textMuted }}>○ {t("dialog.mcp.disabled")}</span>
}

export function DialogMcp() {
  const local = useLocal()
  const sync = useSync()
  const sdk = useSDK()
  const [, setRef] = createSignal<DialogSelectRef<unknown>>()
  const [loading, setLoading] = createSignal<string | null>(null)

  const options = createMemo(() => {
    // Track sync data and loading state to trigger re-render when they change
    const mcpData = sync.data.mcp_product
    const loadingMcp = loading()

    return pipe(
      mcpData,
      sortBy((state) => state.name),
      map((state) => ({
        value: state.name,
        title: state.name,
        description: state.diagnostic?.message ?? (state.availability === "failed" ? t("dialog.mcp.failed") : state.availability),
        footer: <Status state={state} loading={loadingMcp === state.name} />,
        category: undefined,
      })),
    )
  })

  const actions = createMemo(() => [
    {
      command: "dialog.mcp.toggle",
      title: t("dialog.mcp.toggle"),
      onTrigger: async (option: DialogSelectOption<string>) => {
        // Prevent toggling while an operation is already in progress
        if (loading() !== null) return

        const state = sync.data.mcp_product.find((item) => item.name === option.value)
        const action = state ? deriveProductMcpAction(state) : undefined
        if (!action) return
        setLoading(option.value)
        try {
          await local.mcp.run(action)
          // Refresh MCP status from server
          const status = await sdk.client.mcp.status()
          if (status.data) {
            sync.set("mcp", status.data)
            sync.set("mcp_product", toProductMcpStates(status.data))
          } else {
            console.error("Failed to refresh MCP status: no data returned")
          }
        } catch (error) {
          console.error("Failed to toggle MCP:", error)
        } finally {
          setLoading(null)
        }
      },
    },
  ])

  return (
    <DialogSelect
      ref={setRef}
      title={t("dialog.mcp.title")}
      options={options()}
      actions={actions()}
      onSelect={(_option) => {
        // Don't close on select, only on escape
      }}
    />
  )
}
