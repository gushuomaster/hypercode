import type { TuiPlugin, TuiPluginApi } from "@opencode-ai/plugin/tui"
import type { BuiltinTuiPlugin } from "../builtins"
import { createMemo, For, Match, Show, Switch, createSignal } from "solid-js"
import { deriveProductMcpStates } from "@opencode-ai/product"
import { translate } from "../../context/language"
import { toTuiTextKey } from "../../product/text-adapter"

const id = "internal:sidebar-mcp"

function View(props: { api: TuiPluginApi }) {
  const [open, setOpen] = createSignal(true)
  const theme = () => props.api.theme.current
  const list = createMemo(() => deriveProductMcpStates(props.api.state.mcp().map((item) => ({
    name: item.name,
    status: {
      status: item.status,
      ...(item.error ? { error: item.error, raw: item.error } : {}),
    },
  }))))
  const on = createMemo(() => list().filter((item) => item.availability === "connected").length)
  const bad = createMemo(() => list().filter((item) => item.severity !== "none").length)

  const dot = (status: string) => {
    if (status === "none") return theme().success
    if (status === "warning") return theme().warning
    if (status === "error") return theme().error
    return theme().textMuted
  }

  return (
    <Show when={list().length > 0}>
      <box>
        <box flexDirection="row" gap={1} onMouseDown={() => list().length > 2 && setOpen((x) => !x)}>
          <Show when={list().length > 2}>
            <text fg={theme().text}>{open() ? "▼" : "▶"}</text>
          </Show>
          <text fg={theme().text}>
            <b>MCP</b>
            <Show when={!open()}>
              <span style={{ fg: theme().textMuted }}>
                {" "}
                ({bad() > 0
                  ? translate("sidebar.mcp.activeWithErrors", { active: on(), errors: bad() })
                  : translate("sidebar.mcp.active", { count: on() })})
              </span>
            </Show>
          </text>
        </box>
        <Show when={list().length <= 2 || open()}>
          <For each={list()}>
            {(item) => (
              <box flexDirection="row" gap={1}>
                <text
                  flexShrink={0}
                  style={{
                    fg: dot(item.severity),
                  }}
                >
                  •
                </text>
                <text fg={theme().text} wrapMode="word">
                  {item.name}{" "}
                  <span style={{ fg: theme().textMuted }}>
                    <Switch fallback={item.diagnostic?.message ?? item.availability}>
                      <Match when={item.availability === "connected"}>{translate("dialog.status.connected")}</Match>
                      <Match when={item.availability === "failed" && item.diagnostic}>
                        {(diagnostic) => <i>{translate(toTuiTextKey(diagnostic().textKey))}: {diagnostic().raw ?? diagnostic().message}</i>}
                      </Match>
                      <Match when={item.availability === "disabled"}>{translate("dialog.status.disabled")}</Match>
                      <Match when={item.availability === "needs_auth"}>{translate("product.error.mcp.authenticationRequired")}</Match>
                      <Match when={item.availability === "needs_client_registration"}>{translate("product.error.mcp.clientRegistrationRequired")}</Match>
                    </Switch>
                  </span>
                </text>
              </box>
            )}
          </For>
        </Show>
      </box>
    </Show>
  )
}

const tui: TuiPlugin = async (api) => {
  api.slots.register({
    order: 200,
    slots: {
      sidebar_content() {
        return <View api={api} />
      },
    },
  })
}

const plugin: BuiltinTuiPlugin = {
  id,
  tui,
}

export default plugin
