import assert from "node:assert/strict"
import { test } from "node:test"
import { resolveVsCodeProductCommand, toVsCodeCommandTarget, toVsCodeProductCommands } from "./command-adapter"

test("projects VS Code server commands through Product", () => {
  assert.deepEqual(toVsCodeProductCommands([
    { id: "z", name: "z", title: "Zed" },
    { id: "a", name: "a", title: "Alpha" },
  ]).map((entry) => entry.id), ["a", "z"])
})

test("projects the complete shared command catalog from VS Code facts", () => {
  const projection = toVsCodeProductCommands({
    hasSession: true,
    canUndo: true,
    canRedo: true,
    hasVariants: true,
    hasConnectableProvider: true,
    dynamic: [],
  })

  assert.deepEqual(projection.catalog.filter((entry) => entry.scope === "shared").map((entry) => entry.name), [
    "agents",
    "compact",
    "connect",
    "help",
    "mcps",
    "models",
    "new",
    "redo",
    "sessions",
    "skills",
    "status",
    "themes",
    "undo",
    "variants",
  ])
  assert.deepEqual(projection.catalog.find((entry) => entry.id === "model.list")?.aliases, ["model", "mo"])
})

test("resolves Product aliases before colliding remote commands", () => {
  const input = {
    hasSession: true,
    canUndo: true,
    canRedo: true,
    hasVariants: true,
    hasConnectableProvider: true,
    dynamic: [
      { id: "dynamic:mcp", name: "mcp", source: "mcp" },
      { id: "dynamic:review", name: "review", source: "command" },
    ],
  }

  assert.deepEqual(resolveVsCodeProductCommand("/mcp", input), {
    kind: "builtin",
    commandID: "mcp.list",
    arguments: "",
  })
  assert.deepEqual(resolveVsCodeProductCommand("/review staged", input), {
    kind: "dynamic",
    name: "review",
    source: "command",
    arguments: "staged",
  })
  assert.equal(toVsCodeCommandTarget("system.status"), "openSystemStatus")
})
