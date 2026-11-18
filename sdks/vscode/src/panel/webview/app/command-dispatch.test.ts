import assert from "node:assert/strict"
import { describe, test } from "node:test"
import { productCommandIDs } from "@opencode-ai/product"
import {
  toVsCodeCommandTarget,
  toVsCodeProductCommands,
  type VsCodeCommandCatalogInput,
  type VsCodeCommandTarget,
} from "../../../product/command-adapter"
import { t } from "../../../i18n"
import { toVsCodeTextKey } from "../lib/product-text-adapter"
import { planComposerSubmit, runProductCommand, type VsCodeCommandHandlers } from "./command-dispatch"

const catalog: VsCodeCommandCatalogInput = {
  supported: {},
  hasSession: true,
  canUndo: true,
  canRedo: true,
  hasVariants: true,
  hasConnectableProvider: true,
  dynamic: [
    { id: "command:review", name: "review", source: "command" },
    { id: "command:disabled", name: "disabled", source: "command", enabled: false },
  ],
}

const shared = toVsCodeProductCommands(catalog).catalog.filter((entry) => (productCommandIDs as readonly string[]).includes(entry.id))

function recorder() {
  const calls: VsCodeCommandTarget[] = []
  const handlers: VsCodeCommandHandlers = {
    newSession: () => calls.push("newSession"),
    openSessionPicker: () => calls.push("openSessionPicker"),
    openAgentPicker: () => calls.push("openAgentPicker"),
    openModelPicker: () => calls.push("openModelPicker"),
    openMcpStatus: () => calls.push("openMcpStatus"),
    openSystemStatus: () => calls.push("openSystemStatus"),
    compactSession: () => calls.push("compactSession"),
    undoSession: () => calls.push("undoSession"),
    redoSession: () => calls.push("redoSession"),
    openSkillPicker: () => calls.push("openSkillPicker"),
    openThemePicker: () => calls.push("openThemePicker"),
    openCommandHelp: () => calls.push("openCommandHelp"),
    renameSession: () => calls.push("renameSession"),
    shareSession: () => calls.push("shareSession"),
    unshareSession: () => calls.push("unshareSession"),
    forkSession: () => calls.push("forkSession"),
  }
  return { calls, handlers }
}

describe("planComposerSubmit", () => {
  test("every shared Product command runs as a command on Enter instead of being sent as a prompt", () => {
    assert.equal(shared.length, productCommandIDs.length)
    for (const entry of shared) {
      if (entry.availability !== "available") continue
      assert.deepEqual(planComposerSubmit(`/${entry.name}`, catalog), { kind: "command", commandID: entry.id }, entry.name)
    }
  })

  test("aliases resolve to the same command", () => {
    assert.deepEqual(planComposerSubmit("/clear", catalog), { kind: "command", commandID: "session.new" })
    assert.deepEqual(planComposerSubmit("/resume", catalog), { kind: "command", commandID: "session.list" })
  })

  test("/help is a shared command", () => {
    assert.deepEqual(planComposerSubmit("/help", catalog), { kind: "command", commandID: "help.show" })
  })

  test("an unavailable command explains why instead of being sent", () => {
    assert.deepEqual(planComposerSubmit("/compact", { ...catalog, hasSession: false }), {
      kind: "unavailable",
      commandID: "session.compact",
      reasonKey: "command.reason.session_required",
    })
    assert.deepEqual(planComposerSubmit("/undo", { ...catalog, canUndo: false }), {
      kind: "unavailable",
      commandID: "session.undo",
      reasonKey: "command.reason.undo_unavailable",
    })
  })

  test("an unsupported command reports the unsupported reason", () => {
    assert.deepEqual(planComposerSubmit("/new", { ...catalog, supported: { "session.new": false } }), {
      kind: "unavailable",
      commandID: "session.new",
      reasonKey: "command.reason.unsupported",
    })
    assert.deepEqual(planComposerSubmit("/disabled", catalog), {
      kind: "unavailable",
      commandID: "command:disabled",
      reasonKey: "command.reason.unsupported",
    })
  })

  test("unknown slash commands and plain text are still sent as prompts", () => {
    assert.deepEqual(planComposerSubmit("/missing", catalog), { kind: "send" })
    assert.deepEqual(planComposerSubmit("/missing with args", catalog), { kind: "send" })
    assert.deepEqual(planComposerSubmit("hello /new", catalog), { kind: "send" })
    assert.deepEqual(planComposerSubmit("", catalog), { kind: "send" })
  })

  test("dynamic commands keep going through the host slash-command path", () => {
    assert.deepEqual(planComposerSubmit("/review src", catalog), { kind: "send" })
  })
})

describe("runProductCommand", () => {
  test("each command calls exactly the handler for its VS Code target", () => {
    for (const id of productCommandIDs) {
      const { calls, handlers } = recorder()
      runProductCommand(id, handlers)
      assert.deepEqual(calls, [toVsCodeCommandTarget(id)], id)
    }
  })

  test("every handler target is reachable from some shared command", () => {
    const { calls, handlers } = recorder()
    for (const id of productCommandIDs) runProductCommand(id, handlers)
    assert.deepEqual([...new Set(calls)].sort(), Object.keys(handlers).sort())
  })

  test("/help opens the command help from Enter", () => {
    const { calls, handlers } = recorder()
    const plan = planComposerSubmit("/help", catalog)
    assert.equal(plan.kind, "command")
    if (plan.kind === "command") runProductCommand(plan.commandID, handlers)
    assert.deepEqual(calls, ["openCommandHelp"])
  })
})

describe("unavailable command reasons", () => {
  const cases = [
    { input: "/compact", context: { hasSession: false }, text: "此命令需要活动会话。" },
    { input: "/undo", context: { canUndo: false }, text: "当前会话不可撤销。" },
    { input: "/redo", context: { canRedo: false }, text: "当前会话不可重做。" },
    { input: "/variants", context: { hasVariants: false }, text: "没有可用的模型变体。" },
    { input: "/connect", context: { hasConnectableProvider: false }, text: "没有可连接的服务提供商。" },
    { input: "/new", context: { supported: { "session.new": false } }, text: "当前宿主不支持此命令。" },
  ]

  test("Enter on an unavailable command shows the localized Chinese reason and keeps the draft", () => {
    for (const item of cases) {
      const plan = planComposerSubmit(item.input, { ...catalog, ...item.context })
      assert.equal(plan.kind, "unavailable", item.input)
      if (plan.kind !== "unavailable") continue
      assert.equal(t(toVsCodeTextKey(plan.reasonKey), undefined, "zh"), item.text, item.input)
      // Only "send" produces a host message, so an unavailable plan can never turn into a prompt.
      assert.notEqual(plan.kind as string, "send")
    }
  })

  test("every reason resolves to a distinct Chinese message", () => {
    const messages = new Set(cases.map((item) => item.text))
    assert.equal(messages.size, cases.length)
  })
})
