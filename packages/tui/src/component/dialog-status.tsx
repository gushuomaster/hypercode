import { TextAttributes } from "@opentui/core"
import { fileURLToPath } from "bun"
import path from "path"
import { useTheme } from "../context/theme"
import { useDialog } from "../ui/dialog"
import { useSync } from "../context/sync"
import { For, Show, createMemo } from "solid-js"
import { translate as t } from "../context/language"
import { formatTuiProductError } from "../product/text-adapter"
import { deriveProductFormatterSummary, deriveProductLspSummary, deriveProductMcpSummary } from "@opencode-ai/product"
import { toProductCapabilityConfig } from "../product/capability-adapter"
import { toTuiTextKey } from "../product/text-adapter"

export type DialogStatusProps = {}

export function DialogStatus() {
  const sync = useSync()
  const { theme } = useTheme()
  const dialog = useDialog()

  const config = createMemo(() => toProductCapabilityConfig(sync.data.config, sync.status !== "loading"))
  const mcpSummary = createMemo(() => deriveProductMcpSummary({ config: config(), states: sync.data.mcp_product }))
  const lspSummary = createMemo(() => deriveProductLspSummary({ config: config(), states: sync.data.lsp_product }))
  const formatterSummary = createMemo(() => deriveProductFormatterSummary({ config: config(), states: sync.data.formatter_product }))
  const tone = (severity: "none" | "warning" | "error") => (severity === "error" ? theme.error : severity === "warning" ? theme.warning : theme.textMuted)

  const plugins = createMemo(() => {
    const list = sync.data.config.plugin ?? []
    const result = list.map((item) => {
      const value = typeof item === "string" ? item : item[0]
      if (value.startsWith("file://")) {
        const filePath = fileURLToPath(value)
        const parts = filePath.split(path.sep)
        const filename = parts.pop() || filePath
        if (!filename.includes(".")) return { name: filename }
        const basename = filename.split(".")[0]
        if (basename === "index") {
          const dirname = parts.pop()
          const name = dirname || basename
          return { name }
        }
        return { name: basename }
      }
      const index = value.lastIndexOf("@")
      if (index <= 0) return { name: value, version: "latest" }
      const name = value.substring(0, index)
      const version = value.substring(index + 1)
      return { name, version }
    })
    return result.toSorted((a, b) => a.name.localeCompare(b.name))
  })

  return (
    <box paddingLeft={2} paddingRight={2} gap={1} paddingBottom={1}>
      <box flexDirection="row" justifyContent="space-between">
        <text fg={theme.text} attributes={TextAttributes.BOLD}>
          {t("dialog.status.title")}
        </text>
        <text fg={theme.textMuted} onMouseUp={() => dialog.clear()}>
          esc
        </text>
      </box>
      <box>
        <text fg={theme.text}>{t(toTuiTextKey(mcpSummary().textKey))}</text>
        <For each={sync.data.mcp_product}>
          {(item) => (
            <box flexDirection="row" gap={1}>
              <text
                flexShrink={0}
                style={{
                  fg: tone(item.severity),
                }}
              >
                •
              </text>
              <text fg={theme.text} wrapMode="word">
                <b>{item.name}</b>{" "}
                <span style={{ fg: theme.textMuted }}>{item.diagnostic ? formatTuiProductError(item.diagnostic) : t(toTuiTextKey(item.textKey))}</span>
              </text>
            </box>
          )}
        </For>
      </box>
      <box>
        <text fg={theme.text}>{t(toTuiTextKey(lspSummary().textKey))}</text>
        <For each={sync.data.lsp_product}>
          {(item) => (
            <box flexDirection="row" gap={1}>
              <text
                flexShrink={0}
                style={{
                  fg: tone(item.severity),
                }}
              >
                •
              </text>
              <text fg={theme.text} wrapMode="word">
                <b>{item.name}</b>{" "}
                <span style={{ fg: theme.textMuted }}>
                  {item.diagnostic ? formatTuiProductError(item.diagnostic) : item.root}
                </span>
              </text>
            </box>
          )}
        </For>
      </box>
      <box>
        <text fg={theme.text}>{t(toTuiTextKey(formatterSummary().textKey))}</text>
        <For each={sync.data.formatter_product}>
          {(item) => (
            <box flexDirection="row" gap={1}>
              <text
                flexShrink={0}
                style={{
                  fg: tone(item.severity),
                }}
              >
                •
              </text>
              <text wrapMode="word" fg={theme.text}>
                <b>{item.name}</b>{" "}<span style={{ fg: theme.textMuted }}>{t(toTuiTextKey(item.textKey))}</span>
              </text>
            </box>
          )}
        </For>
      </box>
      <Show when={plugins().length > 0} fallback={<text fg={theme.text}>{t("dialog.status.noPlugins")}</text>}>
        <box>
          <text fg={theme.text}>{t("dialog.status.pluginCount", { count: plugins().length })}</text>
          <For each={plugins()}>
            {(item) => (
              <box flexDirection="row" gap={1}>
                <text
                  flexShrink={0}
                  style={{
                    fg: theme.success,
                  }}
                >
                  •
                </text>
                <text wrapMode="word" fg={theme.text}>
                  <b>{item.name}</b>
                  {item.version && <span style={{ fg: theme.textMuted }}> @{item.version}</span>}
                </text>
              </box>
            )}
          </For>
        </box>
      </Show>
    </box>
  )
}
