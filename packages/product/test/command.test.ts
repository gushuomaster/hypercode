import { expect, test } from "bun:test"
import { deriveProductCommandCatalog, deriveProductCommandSessionContext, resolveProductCommand } from "../src/command"
import { sharedCommandContext, sharedCommandIDs, surfaceOptionalCommandIDs } from "./fixtures/command-contract"

const discontinuedCommandIDs = ["session.share", "session.unshare"]

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

  expect(catalog.filter((entry) => entry.scope === "shared").map((entry) => entry.id).sort()).toEqual(sharedCommandIDs)
  expect(catalog.filter((entry) => entry.scope === "shared_surface_optional").map((entry) => entry.id).sort()).toEqual(surfaceOptionalCommandIDs)
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

test("keeps rename and fork surface-optional and requires an active session", () => {
  const catalog = deriveProductCommandCatalog({
    context: { ...sharedCommandContext, hasSession: false, isShared: false },
  })

  for (const id of surfaceOptionalCommandIDs.filter((id) => !discontinuedCommandIDs.includes(id))) {
    expect(catalog.find((entry) => entry.id === id)).toMatchObject({
      scope: "shared_surface_optional",
      availability: "unavailable",
      reasonKey: "command.reason.session_required",
    })
  }
})

test("share and unshare are unsupported even when the host supports them and the session is shared", () => {
  const catalog = deriveProductCommandCatalog({ context: sharedCommandContext })

  for (const id of discontinuedCommandIDs) {
    expect(catalog.find((entry) => entry.id === id)).toMatchObject({
      scope: "shared_surface_optional",
      availability: "unsupported",
      reasonKey: "command.reason.unsupported",
    })
  }
  expect(resolveProductCommand({ value: "/share", catalog })).toEqual({
    kind: "unavailable",
    commandID: "session.share",
    availability: "unsupported",
    reasonKey: "command.reason.unsupported",
  })
})

test("deriveProductCommandSessionContext applies revert boundary to canUndo", () => {
  // revertMessageID = m3：m3 之前只有 m1(user), m2(assistant)，canUndo = true
  const withRevert = deriveProductCommandSessionContext({
    hasSession: true,
    messages: [
      { id: "m1", role: "user" },
      { id: "m2", role: "assistant" },
      { id: "m3", role: "user" },
    ],
    revertMessageID: "m3",
    shareURL: "https://share.example/abc",
  })
  expect(withRevert).toEqual({ hasSession: true, canUndo: true, canRedo: true, isShared: true })

  // revertMessageID = m1：m1 之前无消息，canUndo = false
  const revertAtFirst = deriveProductCommandSessionContext({
    hasSession: true,
    messages: [{ id: "m1", role: "user" }],
    revertMessageID: "m1",
  })
  expect(revertAtFirst).toMatchObject({ canUndo: false, canRedo: true })

  // 无 revert：所有 user 消息可见，canRedo = false
  const noRevert = deriveProductCommandSessionContext({
    hasSession: true,
    messages: [{ id: "m1", role: "user" }],
  })
  expect(noRevert).toMatchObject({ canUndo: true, canRedo: false, isShared: false })

  // 无会话
  const noSession = deriveProductCommandSessionContext({ hasSession: false, messages: [] })
  expect(noSession).toEqual({ hasSession: false, canUndo: false, canRedo: false, isShared: false })
})

test("a host without an entry point gets unsupported instead of a faked command", () => {
  const catalog = deriveProductCommandCatalog({
    context: {
      ...sharedCommandContext,
      supported: { ...sharedCommandContext.supported, "session.fork": false },
    },
  })

  expect(resolveProductCommand({ value: "/fork", catalog })).toEqual({
    kind: "unavailable",
    commandID: "session.fork",
    availability: "unsupported",
    reasonKey: "command.reason.unsupported",
  })
})
