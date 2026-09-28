import { expect, test } from "bun:test"
import { deriveProductCommandCatalog, resolveProductCommand } from "../src/command"
import { sharedCommandContext, sharedCommandIDs } from "./fixtures/command-contract"

test("filters hidden commands, deduplicates IDs, and sorts deterministically", () => {
  expect(deriveProductCommandCatalog([
    { id: "z", name: "z", title: "Zed", category: "tools" },
    { id: "hidden", name: "hidden", title: "Hidden", hidden: true },
    { id: "a", name: "a", title: "Alpha", category: "tools" },
    { id: "z", name: "z", title: "Duplicate", category: "tools" },
  ])).toEqual([
    { id: "a", name: "a", aliases: [], title: "Alpha", category: "tools", scope: "shared_surface_optional", availability: "available" },
    { id: "z", name: "z", aliases: [], title: "Zed", category: "tools", scope: "shared_surface_optional", availability: "available" },
  ])
})

test("owns the canonical shared command catalog independently of host registrations", () => {
  const catalog = deriveProductCommandCatalog({
    context: sharedCommandContext,
    dynamic: [],
  })

  expect(catalog.map((entry) => entry.id).sort()).toEqual(sharedCommandIDs)
  expect(catalog.find((entry) => entry.id === "mcp.list")).toMatchObject({
    name: "mcps",
    aliases: ["mcp"],
    scope: "shared",
    availability: "available",
  })
  expect(catalog.find((entry) => entry.id === "model.list")).toMatchObject({
    name: "models",
    aliases: ["model", "mo"],
  })
})

test("derives contextual availability instead of silently deleting shared commands", () => {
  const catalog = deriveProductCommandCatalog({
    context: {
      ...sharedCommandContext,
      supported: { ...sharedCommandContext.supported, "mcp.list": false },
      hasSession: false,
      canUndo: false,
      canRedo: false,
      hasVariants: false,
      hasConnectableProvider: false,
    },
    dynamic: [],
  })

  expect(catalog.find((entry) => entry.id === "mcp.list")).toMatchObject({
    availability: "unsupported",
    reasonKey: "command.reason.unsupported",
  })
  expect(catalog.find((entry) => entry.id === "session.compact")).toMatchObject({
    availability: "unavailable",
    reasonKey: "command.reason.session_required",
  })
  expect(catalog.find((entry) => entry.id === "variant.list")).toMatchObject({
    availability: "unavailable",
    reasonKey: "command.reason.no_variants",
  })
  expect(catalog.find((entry) => entry.id === "provider.connect")).toMatchObject({
    availability: "unavailable",
    reasonKey: "command.reason.no_provider",
  })
})

test("keeps built-ins ahead of colliding dynamic commands and preserves dynamic sources", () => {
  const catalog = deriveProductCommandCatalog({
    context: sharedCommandContext,
    dynamic: [
      { id: "dynamic:mcp", name: "mcp", title: "Remote MCP", source: "mcp" },
      { id: "dynamic:review", name: "review", title: "Review", source: "command" },
    ],
  })

  expect(catalog.some((entry) => entry.id === "dynamic:mcp")).toBe(false)
  expect(catalog.find((entry) => entry.id === "dynamic:review")).toMatchObject({
    name: "review",
    source: "command",
    scope: "shared_surface_optional",
  })
})

test("resolves canonical names and aliases to the same built-in intent", () => {
  const catalog = deriveProductCommandCatalog({ context: sharedCommandContext })

  expect(resolveProductCommand({ value: "/models", catalog })).toEqual({
    kind: "builtin",
    commandID: "model.list",
    arguments: "",
  })
  expect(resolveProductCommand({ value: "/model", catalog })).toEqual({
    kind: "builtin",
    commandID: "model.list",
    arguments: "",
  })
})

test("keeps unavailable commands distinct from unknown commands", () => {
  const catalog = deriveProductCommandCatalog({
    context: { ...sharedCommandContext, hasSession: false, canUndo: false },
  })

  expect(resolveProductCommand({ value: "/undo", catalog })).toEqual({
    kind: "unavailable",
    commandID: "session.undo",
    availability: "unavailable",
    reasonKey: "command.reason.session_required",
  })
  expect(resolveProductCommand({ value: "/missing", catalog })).toBeUndefined()
})

test("resolves dynamic commands with arguments without treating them as built-ins", () => {
  const catalog = deriveProductCommandCatalog({
    context: sharedCommandContext,
    dynamic: [{ id: "dynamic:review", name: "review", source: "mcp" }],
  })

  expect(resolveProductCommand({ value: "/review branch main", catalog })).toEqual({
    kind: "dynamic",
    name: "review",
    arguments: "branch main",
    source: "mcp",
  })
})
