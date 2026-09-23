import assert from "node:assert/strict"
import { test } from "node:test"
import { productAgents, productProviders, rawAgents, rawProviders } from "../../../../../../packages/product/test/fixtures/model-input"
import { toProductAgents, toProductProviders } from "./product-adapter"

test("normalizes VSCode providers into the shared product model", () => {
  assert.deepEqual(toProductProviders(rawProviders), productProviders)
})

test("normalizes VSCode agents into the shared product model", () => {
  assert.deepEqual(toProductAgents(rawAgents), productAgents)
})
