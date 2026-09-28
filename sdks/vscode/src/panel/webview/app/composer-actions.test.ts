import assert from "node:assert/strict"
import { describe, test } from "node:test"

import { isCompletedSlashCommand, resolveComposerAutocompleteAction, resolveComposerSlashAction } from "./composer-actions"

const catalog = {
  hasSession: true,
  canUndo: true,
  canRedo: true,
  hasVariants: true,
  hasConnectableProvider: true,
  dynamic: [],
}

describe("resolveComposerSlashAction", () => {
  test("routes /new to a local new-session action", () => {
    assert.deepEqual(resolveComposerSlashAction("/new", catalog), {
      kind: "builtin",
      commandID: "session.new",
      arguments: "",
    })
    assert.deepEqual(resolveComposerSlashAction("  /new  ", catalog), {
      kind: "builtin",
      commandID: "session.new",
      arguments: "",
    })
  })

  test("routes /skills to the local skill-picker action", () => {
    assert.deepEqual(resolveComposerSlashAction("/skills", catalog), {
      kind: "builtin",
      commandID: "skill.list",
      arguments: "",
    })
  })

  test("routes /agents to the local agent-picker action", () => {
    assert.deepEqual(resolveComposerSlashAction("/agents", catalog), {
      kind: "builtin",
      commandID: "agent.list",
      arguments: "",
    })
  })

  test("keeps routing /skills to the local skill-picker action when direct slash display is enabled", () => {
    assert.deepEqual(resolveComposerSlashAction("/skills", catalog), {
      kind: "builtin",
      commandID: "skill.list",
      arguments: "",
    })
  })

  test("routes /sessions to a local session-picker action", () => {
    assert.deepEqual(resolveComposerSlashAction("/sessions", catalog), {
      kind: "builtin",
      commandID: "session.list",
      arguments: "",
    })
    assert.deepEqual(resolveComposerSlashAction("  /sessions  ", catalog), {
      kind: "builtin",
      commandID: "session.list",
      arguments: "",
    })
  })

  test("routes /theme to the local theme-picker action", () => {
    assert.deepEqual(resolveComposerSlashAction("/theme", catalog), {
      kind: "builtin",
      commandID: "theme.list",
      arguments: "",
    })
  })

  test("routes known slash commands through the host command path", () => {
    assert.deepEqual(resolveComposerSlashAction("/review now", {
      ...catalog,
      dynamic: [{ id: "dynamic:review", name: "review", source: "command" }],
    }), {
      kind: "dynamic",
      name: "review",
      source: "command",
      arguments: "now",
    })
  })

  test("routes skill slash commands through the host command path", () => {
    assert.deepEqual(resolveComposerSlashAction("/using-superpowers", {
      ...catalog,
      dynamic: [{ id: "dynamic:using-superpowers", name: "using-superpowers", source: "skill" }],
    }), {
      kind: "dynamic",
      name: "using-superpowers",
      source: "skill",
      arguments: "",
    })
  })

  test("ignores unknown slash commands", () => {
    assert.equal(resolveComposerSlashAction("/missing", catalog), undefined)
  })
})

describe("isCompletedSlashCommand", () => {
  test("treats skill commands as completed slash commands", () => {
    assert.equal(isCompletedSlashCommand("/using-superpowers ", {
      ...catalog,
      dynamic: [{ id: "dynamic:using-superpowers", name: "using-superpowers", source: "skill" }],
    }), true)
  })

  test("does not treat local skills action as a completed slash command", () => {
    assert.equal(isCompletedSlashCommand("/skills", catalog), false)
  })
})

describe("resolveComposerAutocompleteAction", () => {
  test("routes slash-agents autocomplete acceptance to the local agent picker", () => {
    assert.deepEqual(resolveComposerAutocompleteAction({
      id: "product:agent.list",
      kind: "action",
    }), {
      type: "builtin",
      commandID: "agent.list",
    })
  })

  test("routes slash-sessions autocomplete acceptance to the local session picker", () => {
    assert.deepEqual(resolveComposerAutocompleteAction({
      id: "product:session.list",
      kind: "action",
    }), {
      type: "builtin",
      commandID: "session.list",
    })
  })

  test("ignores non-local autocomplete items", () => {
    assert.equal(resolveComposerAutocompleteAction({
      id: "command:review",
      kind: "command",
    }), undefined)
  })
})
