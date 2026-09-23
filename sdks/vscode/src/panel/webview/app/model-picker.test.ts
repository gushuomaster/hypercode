import assert from "node:assert/strict"
import { beforeEach, describe, test } from "node:test"
import type { ProviderInfo } from "../../../core/sdk"
import { setLocale } from "../../../i18n"
import { buildModelPickerCatalog, buildModelPickerRecoveryActions, buildModelPickerSections, filterModelPickerSections } from "./model-picker"

beforeEach(() => setLocale("en"))

const providers: ProviderInfo[] = [
  {
    id: "p1",
    name: "Provider 1",
    models: {
      m1: { id: "m1", name: "Model 1", variants: { fast: {}, deep: {} } },
      m2: { id: "m2", name: "Model 2" },
    },
  },
  {
    id: "p2",
    name: "Provider 2",
    models: {
      m3: { id: "m3", name: "Model 3" },
    },
  },
]

describe("model picker sections", () => {
  test("favorites and recents are listed before provider sections without duplicates", () => {
    const sections = buildModelPickerSections({
      providers,
      favorites: [{ providerID: "p1", modelID: "m2" }],
      recents: [{ providerID: "p1", modelID: "m1" }, { providerID: "p1", modelID: "m2" }],
      currentModel: { providerID: "p1", modelID: "m1" },
      variants: { "p1/m1": "fast" },
    })

    assert.deepEqual(sections.map((section) => section.label), ["Favorites", "Recent", "Provider 2"])
    assert.deepEqual(sections[0].items.map((item) => item.id), ["p1/m2"])
    assert.deepEqual(sections[1].items.map((item) => item.id), ["p1/m1"])
    assert.deepEqual(sections[2].items.map((item) => item.id), ["p2/m3"])
    assert.equal(sections[1].items[0].variant, "fast")
    assert.equal(sections[1].items[0].selected, true)
  })

  test("exposes provider auth recovery actions when no models are available but OAuth-capable providers exist", () => {
    const recovery = buildModelPickerRecoveryActions({
      providers: [{
        id: "openai",
        name: "OpenAI",
        models: {},
      }],
      providerAuth: {
        openai: [{ type: "oauth", label: "Connect OpenAI" }],
      },
    })

    assert.deepEqual(recovery, [{
      providerID: "openai",
      label: "OpenAI",
      actionLabel: "Connect OpenAI",
    }])
  })

  test("uses shared TUI model grouping while keeping every model searchable", () => {
    const catalog = buildModelPickerCatalog({
      providers: [{
        id: "opencode",
        name: "HyperCode Zen",
        models: Object.fromEntries(Array.from({ length: 8 }, (_, index) => {
          const id = `m${index}`
          return [id, {
            id,
            name: `Model ${index}`,
            cost: { input: index < 2 ? 0 : 1 },
            release_date: `2026-01-${String(10 - index).padStart(2, "0")}`,
          }]
        })),
      }],
      favorites: [{ providerID: "opencode", modelID: "m2" }],
      recents: [{ providerID: "opencode", modelID: "m3" }],
      configured: [{ providerID: "opencode", modelID: "m4" }],
      currentModel: { providerID: "opencode", modelID: "m5" },
    })

    assert.deepEqual(catalog.sections.map((section) => section.label), [
      "Favorites",
      "Recent",
      "Configured",
      "Current model",
      "Free models",
      "HyperCode Zen",
    ])
    assert.deepEqual(catalog.sections.at(-1)?.items.map((item) => item.id), ["opencode/m6", "opencode/m7"])
    assert.equal(catalog.sections.at(-1)?.collapsedCount, 6)
    assert.equal(catalog.searchItems.length, 8)
    assert.deepEqual(filterModelPickerSections(catalog.sections, catalog.searchItems, "missing"), [])
  })
})
