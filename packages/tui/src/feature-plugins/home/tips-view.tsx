import type { TuiPluginApi } from "@opencode-ai/plugin/tui"
import { createMemo, For, type Accessor } from "solid-js"
import { DEFAULT_THEMES, useTheme } from "../../context/theme"
import { useCommandShortcut } from "../../keymap"
import { translate } from "../../context/language"

const themeCount = Object.keys(DEFAULT_THEMES).length

type TipPart = { text: string; highlight: boolean }
type TipShortcut = Accessor<string>
type Shortcuts = {
  agentCycle: TipShortcut
  childFirst: TipShortcut
  childNext: TipShortcut
  childPrevious: TipShortcut
  commandList: TipShortcut
  editorOpen: TipShortcut
  helpShow: TipShortcut
  inputClear: TipShortcut
  inputNewline: TipShortcut
  inputPaste: TipShortcut
  inputUndo: TipShortcut
  leader: TipShortcut
  messagesCopy: TipShortcut
  messagesFirst: TipShortcut
  messagesLast: TipShortcut
  messagesPageDown: TipShortcut
  messagesPageUp: TipShortcut
  messagesToggleConceal: TipShortcut
  modelCycleRecent: TipShortcut
  modelList: TipShortcut
  sessionExport: TipShortcut
  sessionInterrupt: TipShortcut
  sessionList: TipShortcut
  sessionNew: TipShortcut
  sessionParent: TipShortcut
  sessionPinToggle: TipShortcut
  sessionQuickSwitch1: TipShortcut
  sessionQuickSwitch9: TipShortcut
  sessionSidebarToggle: TipShortcut
  sessionTimeline: TipShortcut
  statusView: TipShortcut
  terminalSuspend: TipShortcut
  themeList: TipShortcut
}
type Tip = string | ((shortcuts: Shortcuts) => string | undefined)

function parse(tip: string): TipPart[] {
  const parts: TipPart[] = []
  const regex = /\{highlight\}(.*?)\{\/highlight\}/g
  const found = Array.from(tip.matchAll(regex))
  const state = found.reduce(
    (acc, match) => {
      const start = match.index ?? 0
      if (start > acc.index) {
        acc.parts.push({ text: tip.slice(acc.index, start), highlight: false })
      }
      acc.parts.push({ text: match[1], highlight: true })
      acc.index = start + match[0].length
      return acc
    },
    { parts, index: 0 },
  )

  if (state.index < tip.length) {
    parts.push({ text: tip.slice(state.index), highlight: false })
  }

  return parts
}

function shortcutText(value: string) {
  return `{highlight}${value}{/highlight}`
}

function commandText(command: string, shortcut: string) {
  if (!shortcut) return shortcutText(command)
  return translate("tip.cmdOr", { cmd: shortcutText(command), key: shortcutText(shortcut) })
}

function configShortcut(api: TuiPluginApi, command: string): TipShortcut {
  return () =>
    api.tuiConfig.keybinds
      .get(command)
      .map((binding) => api.keys.formatSequence(Array.from(api.keymap.parseKeySequence(binding.key))))
      .filter(Boolean)
      .join(", ")
}

export function Tips(props: { api: TuiPluginApi; connected?: boolean }) {
  const theme = useTheme().theme
  const tipOffset = Math.random()
  const shortcuts: Shortcuts = {
    agentCycle: useCommandShortcut("agent.cycle"),
    childFirst: configShortcut(props.api, "session.child.first"),
    childNext: configShortcut(props.api, "session.child.next"),
    childPrevious: configShortcut(props.api, "session.child.previous"),
    commandList: useCommandShortcut("command.palette.show"),
    editorOpen: useCommandShortcut("prompt.editor"),
    helpShow: useCommandShortcut("help.show"),
    inputClear: useCommandShortcut("prompt.clear"),
    inputNewline: useCommandShortcut("input.newline"),
    inputPaste: useCommandShortcut("prompt.paste"),
    inputUndo: useCommandShortcut("input.undo"),
    leader: configShortcut(props.api, "leader"),
    messagesCopy: configShortcut(props.api, "messages.copy"),
    messagesFirst: configShortcut(props.api, "session.first"),
    messagesLast: configShortcut(props.api, "session.last"),
    messagesPageDown: configShortcut(props.api, "session.page.down"),
    messagesPageUp: configShortcut(props.api, "session.page.up"),
    messagesToggleConceal: configShortcut(props.api, "session.toggle.conceal"),
    modelCycleRecent: useCommandShortcut("model.cycle_recent"),
    modelList: useCommandShortcut("model.list"),
    sessionExport: configShortcut(props.api, "session.export"),
    sessionInterrupt: configShortcut(props.api, "session.interrupt"),
    sessionList: useCommandShortcut("session.list"),
    sessionNew: useCommandShortcut("session.new"),
    sessionParent: configShortcut(props.api, "session.parent"),
    sessionPinToggle: configShortcut(props.api, "session.pin.toggle"),
    sessionQuickSwitch1: useCommandShortcut("session.quick_switch.1"),
    sessionQuickSwitch9: useCommandShortcut("session.quick_switch.9"),
    sessionSidebarToggle: configShortcut(props.api, "session.sidebar.toggle"),
    sessionTimeline: configShortcut(props.api, "session.timeline"),
    statusView: useCommandShortcut("opencode.status"),
    terminalSuspend: useCommandShortcut("terminal.suspend"),
    themeList: useCommandShortcut("theme.switch"),
  }
  const tip = createMemo(() => {
    const noModels = translate("tip.noModels")
    if (props.connected === false) return noModels
    const tips = [...TIPS, process.platform !== "win32" ? TERMINAL_SUSPEND_TIP : INPUT_UNDO_TIP].flatMap((item) => {
      const value = typeof item === "string" ? item : item(shortcuts)
      return value ? [value] : []
    })
    return tips[Math.floor(tipOffset * tips.length)] ?? noModels
  })
  const parts = createMemo(() => parse(tip()))

  return (
    <box flexDirection="row" maxWidth="100%">
      <text flexShrink={0} style={{ fg: theme.warning }}>
        ● Tip{" "}
      </text>
      <text flexShrink={1} wrapMode="word">
        <For each={parts()}>
          {(part) => <span style={{ fg: part.highlight ? theme.text : theme.textMuted }}>{part.text}</span>}
        </For>
      </text>
    </box>
  )
}

const TIPS: Tip[] = [
  () => translate("tip.fuzzyFiles"),
  () => translate("tip.shellBang"),
  (s) => (s.agentCycle() ? translate("tip.cycleAgents", { key: shortcutText(s.agentCycle()) }) : undefined),
  () => translate("tip.undo"),
  () => translate("tip.redo"),
  () => translate("tip.share"),
  () => translate("tip.dragDrop"),
  (s) => (s.inputPaste() ? translate("tip.pasteImages", { key: shortcutText(s.inputPaste()) }) : undefined),
  (s) => translate("tip.editor", { cmd: commandText("/editor", s.editorOpen()) }),
  () => translate("tip.init"),
  (s) => translate("tip.models", { cmd: commandText("/models", s.modelList()) }),
  (s) => translate("tip.themes", { cmd: commandText("/themes", s.themeList()), count: themeCount }),
  (s) => translate("tip.new", { cmd: commandText("/new", s.sessionNew()) }),
  (s) => translate("tip.sessions", { cmd: commandText("/sessions", s.sessionList()) }),
  (s) => (s.sessionPinToggle() ? translate("tip.pinSession", { key: shortcutText(s.sessionPinToggle()) }) : undefined),
  (s) =>
    s.sessionQuickSwitch1() && s.sessionQuickSwitch9()
      ? translate("tip.quickSlots", {
          first: shortcutText(s.sessionQuickSwitch1()),
          last: shortcutText(s.sessionQuickSwitch9()),
        })
      : undefined,
  () => translate("tip.compact"),
  (s) => translate("tip.export", { cmd: commandText("/export", s.sessionExport()) }),
  (s) => (s.messagesCopy() ? translate("tip.copyMessage", { key: shortcutText(s.messagesCopy()) }) : undefined),
  (s) => (s.commandList() ? translate("tip.allCommands", { key: shortcutText(s.commandList()) }) : undefined),
  () => translate("tip.connectProviders"),
  (s) => translate("tip.leaderKey", { key: shortcutText(s.leader()) }),
  (s) =>
    s.modelCycleRecent() ? translate("tip.recentModels", { key: shortcutText(s.modelCycleRecent()) }) : undefined,
  (s) =>
    s.sessionSidebarToggle() ? translate("tip.sidebar", { key: shortcutText(s.sessionSidebarToggle()) }) : undefined,
  (s) =>
    s.messagesPageUp() && s.messagesPageDown()
      ? translate("tip.navHistory", {
          up: shortcutText(s.messagesPageUp()),
          down: shortcutText(s.messagesPageDown()),
        })
      : undefined,
  (s) => (s.messagesFirst() ? translate("tip.jumpFirst", { key: shortcutText(s.messagesFirst()) }) : undefined),
  (s) => (s.messagesLast() ? translate("tip.jumpLast", { key: shortcutText(s.messagesLast()) }) : undefined),
  (s) => (s.inputNewline() ? translate("tip.newline", { key: shortcutText(s.inputNewline()) }) : undefined),
  (s) => (s.inputClear() ? translate("tip.clearInput", { key: shortcutText(s.inputClear()) }) : undefined),
  (s) => (s.sessionInterrupt() ? translate("tip.interrupt", { key: shortcutText(s.sessionInterrupt()) }) : undefined),
  () => translate("tip.planAgent"),
  () => translate("tip.atAgent"),
  (s) => {
    const items = [s.sessionParent(), s.childFirst(), s.childPrevious(), s.childNext()].filter(Boolean)
    if (!items.length) return undefined
    return translate("tip.parentChild", { keys: items.map(shortcutText).join(" / ") })
  },
  () => translate("tip.configFiles"),
  () => translate("tip.globalTui"),
  () => translate("tip.schema"),
  () => translate("tip.defaultModel"),
  () => translate("tip.overrideKeybind"),
  () => translate("tip.disableKeybind"),
  () => translate("tip.mcpConfig"),
  () => translate("tip.customCommands"),
  () => translate("tip.commandArgs"),
  () => translate("tip.commandBackticks"),
  () => translate("tip.customAgents"),
  () => translate("tip.agentPermissions"),
  () => translate("tip.bashAllow"),
  () => translate("tip.bashDeny"),
  () => translate("tip.bashAsk"),
  () => translate("tip.formatterOn"),
  () => translate("tip.formatterOff"),
  () => translate("tip.customFormatter"),
  () => translate("tip.lspOn"),
  () => translate("tip.customTools"),
  () => translate("tip.toolScripts"),
  () => translate("tip.pluginHooks"),
  () => translate("tip.pluginNotify"),
  () => translate("tip.pluginProtect"),
  () => translate("tip.runScript"),
  () => translate("tip.continue"),
  () => translate("tip.runFile"),
  () => translate("tip.formatJson"),
  () => translate("tip.serve"),
  () => translate("tip.attach"),
  () => translate("tip.upgrade"),
  () => translate("tip.authList"),
  () => translate("tip.agentCreate"),
  () => translate("tip.githubTrigger"),
  () => translate("tip.githubInstall"),
  () => translate("tip.githubAutoPr"),
  () => translate("tip.ocReview"),
  () => translate("tip.themeSystem"),
  () => translate("tip.themeFiles"),
  () => translate("tip.themeVariants"),
  () => translate("tip.themeColors"),
  () => translate("tip.envVar"),
  () => translate("tip.fileInclude"),
  () => translate("tip.instructions"),
  () => translate("tip.temperature"),
  () => translate("tip.steps"),
  () => translate("tip.disableTool"),
  () => translate("tip.disableMcp"),
  () => translate("tip.perAgentTools"),
  () => translate("tip.shareAuto"),
  () => translate("tip.shareDisabled"),
  () => translate("tip.unshare"),
  () => translate("tip.doomLoop"),
  () => translate("tip.externalDir"),
  () => translate("tip.debugConfig"),
  () => translate("tip.printLogs"),
  (s) => translate("tip.timeline", { cmd: commandText("/timeline", s.sessionTimeline()) }),
  (s) => (s.messagesToggleConceal() ? translate("tip.conceal", { key: shortcutText(s.messagesToggleConceal()) }) : undefined),
  (s) => translate("tip.status", { cmd: commandText("/status", s.statusView()) }),
  () => translate("tip.scrollAccel"),
  (s) =>
    s.commandList()
      ? translate("tip.usernameKey", { key: shortcutText(s.commandList()) })
      : translate("tip.username"),
  () => translate("tip.zenModels"),
  () => translate("tip.commitAgents"),
  () => translate("tip.review"),
  (s) => translate("tip.help", { cmd: commandText("/help", s.helpShow()) }),
  () => translate("tip.rename"),
]

const INPUT_UNDO_TIP: Tip = (s) =>
  s.inputUndo() ? translate("tip.undoInput", { key: shortcutText(s.inputUndo()) }) : undefined
const TERMINAL_SUSPEND_TIP: Tip = (s) =>
  s.terminalSuspend() ? translate("tip.suspend", { key: shortcutText(s.terminalSuspend()) }) : undefined
