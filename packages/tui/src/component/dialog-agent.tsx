import { createMemo } from "solid-js"
import { useLocal } from "../context/local"
import { DialogSelect } from "../ui/dialog-select"
import { useDialog } from "../ui/dialog"
import { useLanguage } from "../context/language"
import { useToast } from "../ui/toast"
import type { PromptRef } from "./prompt"

export function DialogAgent(props: { prompt: () => PromptRef | undefined }) {
  const local = useLocal()
  const dialog = useDialog()
  const toast = useToast()
  const t = useLanguage().t

  function description(item: ReturnType<typeof local.agent.visible>[number]) {
    if (item.name === "build") return t("dialog.agent.description.build")
    if (item.name === "plan") return t("dialog.agent.description.plan")
    if (item.name === "general") return t("dialog.agent.description.general")
    if (item.name === "explore") return t("dialog.agent.description.explore")
    return item.description ?? t("dialog.agent.description.missing")
  }

  const options = createMemo(() =>
    local.agent.visible().map((item) => {
      const subagent = item.mode === "subagent"
      return {
        value: item.name,
        title: item.name,
        details: [description(item)],
        category: subagent ? t("dialog.agent.category.subagent") : t("dialog.agent.category.primary"),
        footer: subagent ? t("dialog.agent.action.invoke") : t("dialog.agent.action.switch"),
      }
    }),
  )

  return (
    <DialogSelect
      title={t("dialog.agent.title")}
      current={local.agent.current()?.name}
      options={options()}
      onSelect={(option) => {
        const agent = local.agent.visible().find((item) => item.name === option.value)
        if (!agent) return
        if (agent.mode !== "subagent") {
          local.agent.set(agent.name)
          dialog.clear()
          return
        }

        const prompt = props.prompt()
        if (!prompt?.insertAgent) {
          toast.show({ variant: "warning", message: t("dialog.agent.promptUnavailable"), duration: 3000 })
          return
        }
        if (!prompt.insertAgent(agent.name)) {
          toast.show({ variant: "warning", message: t("dialog.agent.shellUnavailable"), duration: 3000 })
          return
        }
        dialog.clear()
        prompt.focus()
      }}
    />
  )
}
