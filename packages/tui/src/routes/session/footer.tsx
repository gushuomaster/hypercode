import { createMemo, Match, onCleanup, onMount, Show, Switch } from "solid-js"
import { useTheme } from "../../context/theme"
import { useSync } from "../../context/sync"
import { useDirectory } from "../../context/directory"
import { useConnected } from "../../component/use-connected"
import { createStore } from "solid-js/store"
import { useRoute } from "../../context/route"
import { translate as t } from "../../context/language"
import { deriveProductLspSummary, deriveProductMcpSummary } from "@opencode-ai/product"
import { toProductCapabilityConfig } from "../../product/capability-adapter"

export function Footer() {
  const { theme } = useTheme()
  const sync = useSync()
  const route = useRoute()
  const config = createMemo(() => toProductCapabilityConfig(sync.data.config, sync.status !== "loading"))
  const mcpSummary = createMemo(() => deriveProductMcpSummary({ config: config(), states: sync.data.mcp_product }))
  const mcp = createMemo(() => mcpSummary().activeCount)
  const mcpError = createMemo(() => mcpSummary().severity === "error")
  const lsp = createMemo(() => sync.data.lsp_product)
  const lspSummary = createMemo(() => deriveProductLspSummary({ config: config(), states: lsp() }))
  const lspError = createMemo(() => lspSummary().severity === "error")
  const permissions = createMemo(() => {
    if (route.data.type !== "session") return []
    return sync.data.permission[route.data.sessionID] ?? []
  })
  const directory = useDirectory()
  const connected = useConnected()

  const [store, setStore] = createStore({
    welcome: false,
  })

  onMount(() => {
    // Track all timeouts to ensure proper cleanup
    const timeouts: ReturnType<typeof setTimeout>[] = []

    function tick() {
      if (connected()) return
      if (!store.welcome) {
        setStore("welcome", true)
        timeouts.push(setTimeout(() => tick(), 5000))
        return
      }

      if (store.welcome) {
        setStore("welcome", false)
        timeouts.push(setTimeout(() => tick(), 10_000))
        return
      }
    }
    timeouts.push(setTimeout(() => tick(), 10_000))

    onCleanup(() => {
      timeouts.forEach(clearTimeout)
    })
  })

  return (
    <box flexDirection="row" justifyContent="space-between" gap={1} flexShrink={0}>
      <text fg={theme.textMuted}>{directory()}</text>
      <box gap={2} flexDirection="row" flexShrink={0}>
        <Switch>
          <Match when={store.welcome}>
            <text fg={theme.text}>
              {t("session.footer.getStarted")} <span style={{ fg: theme.textMuted }}>/connect</span>
            </text>
          </Match>
          <Match when={connected()}>
            <Show when={permissions().length > 0}>
              <text fg={theme.warning}>
                <span style={{ fg: theme.warning }}>△</span>{" "}
                {t("session.footer.permissions", { count: permissions().length })}
              </text>
            </Show>
            <text fg={theme.text}>
              <span style={{ fg: lspError() ? theme.error : lspSummary().availability === "healthy" ? theme.success : theme.textMuted }}>•</span>{" "}
              {lspSummary().activeCount} LSP
            </text>
            <Show when={mcp()}>
              <text fg={theme.text}>
                <Switch>
                  <Match when={mcpError()}>
                    <span style={{ fg: theme.error }}>⊙ </span>
                  </Match>
                  <Match when={true}>
                    <span style={{ fg: theme.success }}>⊙ </span>
                  </Match>
                </Switch>
                {mcp()} MCP
              </text>
            </Show>
            <text fg={theme.textMuted}>/status</text>
          </Match>
        </Switch>
      </box>
    </box>
  )
}
