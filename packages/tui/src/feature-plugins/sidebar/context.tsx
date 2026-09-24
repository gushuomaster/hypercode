import type { AssistantMessage } from "@opencode-ai/sdk/v2"
import type { TuiPlugin, TuiPluginApi } from "@opencode-ai/plugin/tui"
import type { BuiltinTuiPlugin } from "../builtins"
import { createMemo } from "solid-js"
import { translate as t } from "../../context/language"
import { deriveProductContextUsage, type ProductContextUsage } from "@opencode-ai/product"

const id = "internal:sidebar-context"

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
})

export function sidebarContextUsageText(usage: ProductContextUsage) {
  if (usage.availability === "unknown") return { textKey: "sidebar.context.limitUnknown" as const }
  return { textKey: "sidebar.context.used" as const, params: { percent: usage.percent } }
}

function View(props: { api: TuiPluginApi; session_id: string }) {
  const theme = () => props.api.theme.current
  const msg = createMemo(() => props.api.state.session.messages(props.session_id))
  const session = createMemo(() => props.api.state.session.get(props.session_id))
  const cost = createMemo(() => session()?.cost ?? 0)

  const state = createMemo(() => {
    const last = msg().findLast((item): item is AssistantMessage => item.role === "assistant" && item.tokens.output > 0)
    if (!last) {
      return {
        tokens: 0,
        usage: deriveProductContextUsage(0, undefined),
      }
    }

    const tokens =
      last.tokens.input + last.tokens.output + last.tokens.reasoning + last.tokens.cache.read + last.tokens.cache.write
    const model = props.api.state.provider.find((item) => item.id === last.providerID)?.models[last.modelID]
    return {
      tokens,
      usage: deriveProductContextUsage(tokens, model?.limit.context),
    }
  })
  const usage = createMemo(() => sidebarContextUsageText(state().usage))

  return (
    <box>
      <text fg={theme().text}>
        <b>{t("sidebar.context.title")}</b>
      </text>
      <text fg={theme().textMuted}>{t("sidebar.context.tokens", { count: state().tokens.toLocaleString() })}</text>
      <text fg={theme().textMuted}>{t(usage().textKey, "params" in usage() ? usage().params : undefined)}</text>
      <text fg={theme().textMuted}>{t("sidebar.context.spent", { cost: money.format(cost()) })}</text>
    </box>
  )
}

const tui: TuiPlugin = async (api) => {
  api.slots.register({
    order: 100,
    slots: {
      sidebar_content(_ctx, props) {
        return <View api={api} session_id={props.session_id} />
      },
    },
  })
}

const plugin: BuiltinTuiPlugin = {
  id,
  tui,
}

export default plugin
