import { createMemo, createSignal } from "solid-js"
import { useLocal } from "../context/local"
import { useSync } from "../context/sync"
import { map, pipe, sortBy } from "remeda"
import { DialogSelect, type DialogSelectRef, type DialogSelectOption } from "../ui/dialog-select"
import { useTheme } from "../context/theme"
import { useSDK } from "../context/sdk"
import { translate as t } from "../context/language"
import { deriveProductMcpAction, type ProductMcpActionName, type ProductMcpState } from "@opencode-ai/product"
import { toProductMcpStates } from "../product/mcp-adapter"
import { toTuiTextKey } from "../product/text-adapter"
import { useToast } from "../ui/toast"

// Chinese title explains the failure; the original error stays in the message for diagnosis.
export function mcpFailureToast(kind: "toggle" | "refresh", error?: unknown) {
  const raw = error instanceof Error ? error.message : error === undefined ? undefined : String(error)
  return {
    variant: "error" as const,
    title: t(kind === "toggle" ? "dialog.mcp.toggleFailed" : "dialog.mcp.refreshFailed"),
    message: raw || t(kind === "refresh" ? "dialog.mcp.refreshNoData" : "dialog.mcp.toggleFailed"),
  }
}

// Host only renders: the label comes from Product's per-item textKey and the tone from Product's severity.
function Status(props: { state: ProductMcpState }) {
  const { theme } = useTheme()
  const tone = () => {
    if (props.state.severity === "error") return { fg: theme.error, icon: "!" }
    if (props.state.severity === "warning") return { fg: theme.warning, icon: "!" }
    return { fg: theme.textMuted, icon: "○" }
  }
  return (
    <span style={{ fg: tone().fg }}>
      {tone().icon} {t(toTuiTextKey(props.state.textKey))}
    </span>
  )
}

export function DialogMcp() {
  const local = useLocal()
  const sync = useSync()
  const sdk = useSDK()
  const toast = useToast()
  const [, setRef] = createSignal<DialogSelectRef<unknown>>()
  // Raw fact only: which host action is running for which server. Product decides what that means.
  const [pending, setPending] = createSignal<Record<string, ProductMcpActionName>>({})

  const states = createMemo(() => toProductMcpStates(sync.data.mcp, pending()))

  const options = createMemo(() =>
    pipe(
      states(),
      sortBy((state) => state.name),
      map((state) => ({
        value: state.name,
        title: state.name,
        description: state.diagnostic?.message ?? t(toTuiTextKey(state.textKey)),
        footer: <Status state={state} />,
        category: undefined,
      })),
    ),
  )

  const actions = createMemo(() => [
    {
      command: "dialog.mcp.toggle",
      title: t("dialog.mcp.toggle"),
      onTrigger: async (option: DialogSelectOption<string>) => {
        const state = states().find((item) => item.name === option.value)
        const action = state ? deriveProductMcpAction(state) : undefined
        // Product returns no action while this server is already connecting or disconnecting.
        if (!state?.action || !action) return
        const running = state.action
        setPending((current) => ({ ...current, [option.value]: running }))
        try {
          await local.mcp.run(action)
          // Refresh MCP status from server
          const status = await sdk.client.mcp.status()
          if (status.data) {
            sync.set("mcp", status.data)
            sync.set("mcp_product", toProductMcpStates(status.data))
          } else {
            console.error("Failed to refresh MCP status: no data returned")
            toast.show(mcpFailureToast("refresh"))
          }
        } catch (error) {
          console.error("Failed to toggle MCP:", error)
          toast.show(mcpFailureToast("toggle", error))
        } finally {
          setPending(({ [option.value]: _done, ...rest }) => rest)
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
