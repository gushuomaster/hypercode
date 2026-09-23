import { expect, test } from "bun:test"
import { toProductAgents, toProductProviders, toTuiModelCatalog } from "../../src/product/model-adapter"
import { productAgents, productProviders, rawAgents, rawProviders } from "../../../product/test/fixtures/model-input"

test("normalizes TUI providers into the shared product model", () => {
  expect(toProductProviders(rawProviders)).toEqual(productProviders)
})

test("normalizes TUI agents into the shared product model", () => {
  expect(toProductAgents(rawAgents)).toEqual(productAgents)
})

test("keeps Product search filtering and model order", () => {
  const catalog = toTuiModelCatalog({
    providers: [{
      id: "opencode",
      models: {
        "zulu-free": {
          id: "zulu-free",
          name: "Zulu Free",
          cost: { input: 0 },
          release_date: "not-a-date",
        },
        "alpha-free": {
          id: "alpha-free",
          name: "Alpha Free",
          cost: { input: 0 },
        },
        paid: {
          id: "paid",
          name: "Paid",
          cost: { input: 1 },
        },
      },
    }],
    favorites: [],
    recents: [],
    configured: [],
    query: "free",
  })

  expect(catalog.sections[0]?.items.map((item) => item.model.id)).toEqual([
    "alpha-free",
    "zulu-free",
  ])
})
