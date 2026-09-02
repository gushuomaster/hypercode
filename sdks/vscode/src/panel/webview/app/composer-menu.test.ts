import assert from "node:assert/strict"
import { describe, test } from "node:test"

import { autocompleteItemView, buildComposerMenuItems } from "./composer-menu"
import { createInitialState } from "./state"

describe("buildComposerMenuItems", () => {
  test("includes a local slash action for agents", () => {
    const state = createInitialState({
      workspaceId: "file:///workspace",
      dir: "/workspace",
      sessionId: "session-1",
    })

    const item = buildComposerMenuItems(state, []).find((entry) => entry.id === "slash-agents")

    assert.ok(item)
    assert.equal(item.label, "agents")
    assert.equal(item.kind, "action")
  })

  test("includes a local slash action for new session", () => {
    const state = createInitialState({
      workspaceId: "file:///workspace",
      dir: "/workspace",
      sessionId: "session-1",
    })

    const items = buildComposerMenuItems(state, [])
    const newItem = items.find((item) => item.trigger === "slash" && item.label === "new")

    assert.ok(newItem)
    assert.equal(newItem?.kind, "action")
  })

  test("includes a local slash action for skills", () => {
    const state = createInitialState({
      workspaceId: "file:///workspace",
      dir: "/workspace",
      sessionId: "session-1",
    })

    const items = buildComposerMenuItems(state, [])
    const skillsItem = items.find((item) => item.trigger === "slash" && item.label === "skills")

    assert.ok(skillsItem)
    assert.equal(skillsItem?.kind, "action")
  })

  test("keeps skill commands in the skill picker even when direct slash display is enabled", () => {
    const state = createInitialState({
      workspaceId: "file:///workspace",
      dir: "/workspace",
      sessionId: "session-1",
    })
    state.snapshot.display.showSkillsInSlashAutocomplete = true
    state.snapshot.commands = [{
      name: "using-superpowers",
      description: "Load the superpowers workflow",
      hints: [],
      source: "skill",
    }]

    const items = buildComposerMenuItems(state, [])
    const localSkillsAction = items.find((item) => item.id === "slash-skills")
    const skillCommand = items.find((item) => item.trigger === "skill" && item.label === "using-superpowers")

    assert.ok(localSkillsAction)
    assert.ok(skillCommand)
    assert.equal(skillCommand?.kind, "SKILL")
  })

  test("falls back to skill catalog when deferred skill commands are missing", () => {
    const state = createInitialState({
      workspaceId: "file:///workspace",
      dir: "/workspace",
      sessionId: "session-1",
    })
    state.snapshot.skillCatalog = [{
      name: "test",
      content: "Confirm the global skill loader is working",
      location: "/skills/test/SKILL.md",
    }]

    const items = buildComposerMenuItems(state, [])
    const skillCommand = items.find((item) => item.trigger === "skill" && item.label === "test")

    assert.ok(skillCommand)
    assert.equal(skillCommand?.kind, "SKILL")
  })

  test("includes a local slash action for theme", () => {
    const state = createInitialState({
      workspaceId: "file:///workspace",
      dir: "/workspace",
      sessionId: "session-1",
    })

    const items = buildComposerMenuItems(state, [])
    const themeItem = items.find((item) => item.trigger === "slash" && item.label === "theme")

    assert.ok(themeItem)
    assert.equal(themeItem?.kind, "action")
  })

  test("keeps long autocomplete detail text intact for responsive CSS truncation", () => {
    const detail = "Create and update pitch decks, one-pagers, investor memos, accelerator applications, financial models, and fundraising materials for active investor conversations."
    const view = autocompleteItemView("", {
      id: "skill:investor-materials",
      label: "investor-materials",
      detail,
      trigger: "slash",
      kind: "SKILL",
    })

    assert.equal(view.detail, detail)
    assert.equal(view.fullDetail, detail)
  })
})
