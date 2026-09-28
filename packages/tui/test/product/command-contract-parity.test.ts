import { expect, test } from "bun:test"
import { sharedCommandIDs } from "../../../product/test/fixtures/command-contract"
import { toTuiCommandTarget, toTuiProductCommands } from "../../src/product/command-adapter"

test("projects the complete Product command contract into TUI targets", () => {
  const targets = [
    "session.new",
    "session.list",
    "agent.list",
    "model.list",
    "variant.list",
    "provider.connect",
    "mcp.list",
    "opencode.status",
    "session.compact",
    "session.undo",
    "session.redo",
    "prompt.skills",
    "theme.switch",
    "help.show",
  ]
  const projection = toTuiProductCommands({ registered: targets, reachable: targets })

  expect(projection.catalog.map((entry) => entry.id).sort()).toEqual(sharedCommandIDs)
  expect(projection.catalog.find((entry) => entry.id === "mcp.list")).toMatchObject({
    name: "mcps",
    aliases: ["mcp"],
    availability: "available",
  })
  expect(projection.catalog.find((entry) => entry.id === "model.list")).toMatchObject({
    aliases: ["model", "mo"],
  })
  expect(projection.catalog.find((entry) => entry.id === "theme.list")).toMatchObject({
    name: "themes",
    aliases: ["theme"],
    availability: "available",
  })
  expect(toTuiCommandTarget("system.status")).toBe("opencode.status")
  expect(toTuiCommandTarget("skill.list")).toBe("prompt.skills")
})
