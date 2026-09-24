import { TextAttributes } from "@opentui/core"
import { useTheme } from "../context/theme"
import { useDialog } from "./dialog"
import { useBindings, useCommandShortcut } from "../keymap"
import { translate as t } from "../context/language"
import { toTuiProductHelpTopics } from "../product/help-adapter"

export function DialogHelp() {
  const dialog = useDialog()
  const { theme } = useTheme()
  const commandShortcut = useCommandShortcut("command.palette.show")
  const helpTopic = toTuiProductHelpTopics()[0]

  useBindings(() => ({
    bindings: [
      { key: "return", desc: t("dialog.help.close"), group: t("dialog.category"), cmd: () => dialog.clear() },
      { key: "escape", desc: t("dialog.help.close"), group: t("dialog.category"), cmd: () => dialog.clear() },
    ],
  }))

  if (helpTopic?.availability !== "available") return null

  return (
    <box paddingLeft={2} paddingRight={2} gap={1}>
      <box flexDirection="row" justifyContent="space-between">
        <text attributes={TextAttributes.BOLD} fg={theme.text}>
          {t("dialog.help.title")}
        </text>
        <text fg={theme.textMuted} onMouseUp={() => dialog.clear()}>
          esc/enter
        </text>
      </box>
      <box paddingBottom={1}>
        <text fg={theme.textMuted}>
          {t("dialog.help.message", { key: commandShortcut() })}
        </text>
      </box>
      <box flexDirection="row" justifyContent="flex-end" paddingBottom={1}>
        <box paddingLeft={3} paddingRight={3} backgroundColor={theme.primary} onMouseUp={() => dialog.clear()}>
          <text fg={theme.selectedListItemText}>{t("dialog.action.ok")}</text>
        </box>
      </box>
    </box>
  )
}
