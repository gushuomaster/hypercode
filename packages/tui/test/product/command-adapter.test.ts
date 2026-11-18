import { expect, test } from "bun:test"
import {
  resolveTuiProductCommand,
  toTuiDynamicProductCommands,
  toTuiPaletteCommands,
  toTuiProductCommands,
  toTuiSlashCommands,
} from "../../src/product/command-adapter"

test("projects TUI palette commands through Product", () => {
  expect(toTuiProductCommands([
    { id: "z", name: "z", title: "Zed" },
    { id: "a", name: "a", title: "Alpha" },
  ]).map((entry) => entry.id)).toEqual(["a", "z"])
})

test("keeps missing session context unavailable and filters dynamic alias collisions through Product", () => {
  const projection = toTuiProductCommands({
    registered: ["session.new", "model.list", "mcp.list"],
    reachable: ["session.new", "model.list", "mcp.list"],
  })
  const dynamic = toTuiDynamicProductCommands(projection.context, [
    { id: "dynamic:mcp", name: "mcp", title: "Remote MCP", source: "mcp" },
    { id: "dynamic:review", name: "review", title: "Review", source: "command" },
  ])

  expect(projection.catalog.find((entry) => entry.id === "session.compact")).toMatchObject({
    availability: "unavailable",
    reasonKey: "command.reason.session_required",
  })
  expect(dynamic.map((entry) => entry.id)).toEqual(["dynamic:review"])
})

test("builds slash entries from Product while preserving explicit TUI-only commands", () => {
  const sharedTargets = [
    "session.new",
    "session.list",
    "agent.list",
    "model.list",
    "variant.list",
    "provider.connect",
    "mcp.list",
    "opencode.status",
    "theme.switch",
    "help.show",
  ]
  const result = toTuiSlashCommands({
    registered: [
      ...sharedTargets.map((name) => ({ name, title: `TUI ${name}` })),
      { name: "opencode.debug", title: "Debug", slashName: "debug" },
    ],
    reachable: sharedTargets.filter((name) => name !== "variant.list").concat("opencode.debug"),
  })

  expect(result.entries.find((entry) => entry.id === "mcp.list")).toMatchObject({
    display: "/mcps",
    aliases: ["/mcp"],
    target: "mcp.list",
  })
  expect(result.entries.find((entry) => entry.id === "theme.list")).toMatchObject({
    display: "/themes",
    aliases: ["/theme"],
    target: "theme.switch",
  })
  expect(result.entries.some((entry) => entry.id === "variant.list")).toBe(false)
  expect(result.entries.find((entry) => entry.id === "host:opencode.debug")).toMatchObject({
    display: "/debug",
    target: "opencode.debug",
  })
})

test("classifies shared and TUI-only palette commands without local shared ownership", () => {
  expect(toTuiPaletteCommands({
    registered: ["opencode.debug", "mcp.list", "session.new"],
    reachable: ["opencode.debug", "mcp.list", "session.new"],
  })).toEqual([
    { id: "mcp.list", target: "mcp.list", scope: "shared" },
    { id: "session.new", target: "session.new", scope: "shared" },
    { id: "host:opencode.debug", target: "opencode.debug", scope: "host_only" },
  ])
})

test("surface-optional commands appear in slash and palette when registered and reachable", () => {
  const sharedTargets = ["session.new", "session.list", "mcp.list", "opencode.status", "help.show", "session.compact"]
  const optionalTargets = ["session.rename", "session.fork"]
  const all = [...sharedTargets, ...optionalTargets]

  const slash = toTuiSlashCommands({
    registered: all.map((name) => ({ name, title: `TUI ${name}` })),
    reachable: all,
  })
  expect(slash.entries.some((e) => e.id === "session.rename")).toBe(true)
  expect(slash.entries.some((e) => e.id === "session.fork")).toBe(true)

  const palette = toTuiPaletteCommands({ registered: all, reachable: all })
  expect(palette.some((e) => e.id === "session.rename" && e.scope === "shared_surface_optional")).toBe(true)
  expect(palette.some((e) => e.id === "session.fork" && e.scope === "shared_surface_optional")).toBe(true)
})

test("resolves typed aliases before colliding server commands", () => {
  const projection = toTuiProductCommands({
    registered: ["mcp.list", "opencode.status"],
    reachable: ["mcp.list", "opencode.status"],
  })
  const dynamic = [
    { id: "dynamic:mcp", name: "mcp", title: "Remote MCP", source: "mcp" },
    { id: "dynamic:review", name: "review", title: "Review", source: "command" },
  ]

  expect(resolveTuiProductCommand({ value: "/mcp", context: projection.context, dynamic })).toEqual({
    kind: "builtin",
    commandID: "mcp.list",
    target: "mcp.list",
    arguments: "",
  })
  expect(resolveTuiProductCommand({ value: "/review staged", context: projection.context, dynamic })).toEqual({
    kind: "dynamic",
    name: "review",
    source: "command",
    arguments: "staged",
  })
})
