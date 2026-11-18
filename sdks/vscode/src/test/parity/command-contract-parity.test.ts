import assert from "node:assert/strict"
import { test } from "node:test"
import { sharedCommandIDs, surfaceOptionalCommandIDs, contextFromFacts, exampleSessionFacts, emptySessionFacts } from "../../../../../packages/product/test/fixtures/command-contract"
import { toVsCodeProductCommands } from "../../product/command-adapter"

test("VS Code exposes the same shared Product command IDs as the contract fixture", () => {
  const projection = toVsCodeProductCommands({
    supported: {},
    hasSession: true,
    canUndo: true,
    canRedo: true,
    hasVariants: true,
    hasConnectableProvider: true,
  })
  assert.deepEqual(projection.catalog.filter((entry) => entry.scope === "shared").map((entry) => entry.id).sort(), sharedCommandIDs)
  assert.deepEqual(projection.catalog.filter((entry) => entry.scope === "shared_surface_optional").map((entry) => entry.id).sort(), surfaceOptionalCommandIDs)
})

test("VS Code derives undo/redo availability from Product session facts, respecting revert boundary", () => {
  const withSession = toVsCodeProductCommands(contextFromFacts(exampleSessionFacts))
  assert.equal(withSession.catalog.find((entry) => entry.id === "session.undo")?.availability, "available")
  assert.equal(withSession.catalog.find((entry) => entry.id === "session.redo")?.availability, "available")
  // Session sharing is discontinued, so unshare stays unsupported even for a shared session.
  assert.equal(withSession.catalog.find((entry) => entry.id === "session.unshare")?.availability, "unsupported")

  const noSession = toVsCodeProductCommands(contextFromFacts(emptySessionFacts))
  assert.equal(noSession.catalog.find((entry) => entry.id === "session.undo")?.availability, "unavailable")
  assert.equal(noSession.catalog.find((entry) => entry.id === "session.redo")?.availability, "unavailable")
})
