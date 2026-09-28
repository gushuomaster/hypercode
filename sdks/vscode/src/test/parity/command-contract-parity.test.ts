import assert from "node:assert/strict"
import { test } from "node:test"
import { sharedCommandIDs } from "../../../../../packages/product/test/fixtures/command-contract"
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
})
