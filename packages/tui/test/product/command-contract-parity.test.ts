import { expect, test } from "bun:test"
import { sharedCommandIDs, surfaceOptionalCommandIDs, contextFromFacts, exampleSessionFacts, emptySessionFacts } from "../../../product/test/fixtures/command-contract"
import { toTuiCommandTarget, toTuiProductCommands } from "../../src/product/command-adapter"
import { deriveProductCommandCatalog } from "@opencode-ai/product"

test("TUI derives undo/redo availability from Product session facts, matching VSCode on equivalent state", () => {
  const withSession = deriveProductCommandCatalog({ context: contextFromFacts(exampleSessionFacts) })
  expect(withSession.find((entry) => entry.id === "session.undo")?.availability).toBe("available")
  expect(withSession.find((entry) => entry.id === "session.redo")?.availability).toBe("available")
  // Session sharing is discontinued, so unshare stays unsupported even for a shared session.
  expect(withSession.find((entry) => entry.id === "session.unshare")?.availability).toBe("unsupported")

  const noSession = deriveProductCommandCatalog({ context: contextFromFacts(emptySessionFacts) })
  expect(noSession.find((entry) => entry.id === "session.undo")?.availability).toBe("unavailable")
  expect(noSession.find((entry) => entry.id === "session.redo")?.availability).toBe("unavailable")
})

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
    "session.rename",
    "session.share",
    "session.unshare",
    "session.fork",
  ]
  const projection = toTuiProductCommands({ registered: targets, reachable: targets })

  const allContractIDs = [...sharedCommandIDs, ...surfaceOptionalCommandIDs].sort()
  expect(projection.catalog.map((entry) => entry.id).sort()).toEqual(allContractIDs)
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
