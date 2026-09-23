import { describe, expect, test } from "bun:test"
import {
  cycleModelVariant,
  createProductSnapshot,
  deriveComposerSelection,
  deriveModelCatalog,
  derivePendingInteraction,
  isProductSessionRunning,
  reduceProductEvent,
  type ProductSnapshot,
  type ProductProvider,
} from "../src"

const providers: ProductProvider[] = [
  {
    id: "opencode",
    name: "HyperCode Zen",
    models: [
      { id: "free-new", name: "Free New", free: true, releaseDate: "2026-01-01" },
      { id: "free-old", name: "Free Old", free: true, releaseDate: "2025-01-01" },
      { id: "paid", name: "Paid", releaseDate: "2026-02-01", variants: { fast: {}, deep: {} } },
      { id: "paid-2", name: "Paid 2", releaseDate: "2026-01-01" },
      { id: "paid-3", name: "Paid 3", releaseDate: "2025-12-01" },
      { id: "paid-4", name: "Paid 4", releaseDate: "2025-11-01" },
      { id: "paid-5", name: "Paid 5", releaseDate: "2025-10-01" },
      { id: "paid-6", name: "Paid 6", releaseDate: "2025-09-01" },
    ],
  },
  {
    id: "other",
    name: "Other Provider",
    models: [{ id: "other-model", name: "Other Model", releaseDate: "2026-03-01" }],
  },
]

describe("cycleModelVariant", () => {
  test("returns to the default variant after the final option", () => {
    expect(cycleModelVariant(providers, { providerID: "opencode", modelID: "paid" }, undefined)).toBe("fast")
    expect(cycleModelVariant(providers, { providerID: "opencode", modelID: "paid" }, "fast")).toBe("deep")
    expect(cycleModelVariant(providers, { providerID: "opencode", modelID: "paid" }, "deep")).toBeUndefined()
  })
})

describe("deriveModelCatalog", () => {
  test("keeps pinned sections unique and caps provider sections", () => {
    const catalog = deriveModelCatalog({
      providers,
      favorites: [{ providerID: "opencode", modelID: "paid" }],
      recents: [
        { providerID: "opencode", modelID: "paid" },
        { providerID: "other", modelID: "other-model" },
      ],
      configured: [{ providerID: "opencode", modelID: "paid-2" }],
      current: { providerID: "opencode", modelID: "paid-3" },
    })

    expect(catalog.sections.map((section) => section.id)).toEqual([
      "favorites",
      "recent",
      "configured",
      "current",
      "free",
      "provider:opencode",
    ])
    expect(catalog.sections[0]?.items.map((item) => item.modelRef.modelID)).toEqual(["paid"])
    expect(catalog.sections[1]?.items.map((item) => item.modelRef.modelID)).toEqual(["other-model"])
    expect(catalog.sections[2]?.items.map((item) => item.modelRef.modelID)).toEqual(["paid-2"])
    expect(catalog.sections[3]?.items.map((item) => item.modelRef.modelID)).toEqual(["paid-3"])
    expect(catalog.sections.find((section) => section.id === "provider:opencode")?.items.map((item) => item.modelRef.modelID)).toEqual([
      "paid-4",
      "paid-5",
      "paid-6",
    ])
    expect(catalog.sections.find((section) => section.id === "provider:opencode")?.collapsedCount).toBe(6)
    expect(catalog.searchItems.filter((item) => item.provider.id === "opencode").map((item) => item.modelRef.modelID)).toEqual([
      "free-new",
      "free-old",
      "paid",
      "paid-2",
      "paid-3",
      "paid-4",
      "paid-5",
      "paid-6",
    ])
  })

  test("searches all valid models without provider truncation", () => {
    const catalog = deriveModelCatalog({
      providers,
      favorites: [],
      recents: [],
      configured: [],
      query: "paid",
    })

    expect(catalog.sections).toHaveLength(1)
    expect(catalog.sections[0]?.id).toBe("search")
    expect(catalog.sections[0]?.items.map((item) => item.modelRef.modelID)).toEqual([
      "paid",
      "paid-2",
      "paid-3",
      "paid-4",
      "paid-5",
      "paid-6",
    ])
  })

  test("orders the built-in provider first and remaining providers by name", () => {
    const catalog = deriveModelCatalog({
      providers: [
        { id: "zeta", name: "Zeta", models: [{ id: "z", name: "Z" }] },
        { id: "alpha", name: "Alpha", models: [{ id: "a", name: "A" }] },
        providers[0],
      ],
      favorites: [],
      recents: [],
      configured: [],
    })

    expect(catalog.sections.filter((section) => section.kind === "provider").map((section) => section.id)).toEqual([
      "provider:opencode",
      "provider:alpha",
      "provider:zeta",
    ])
  })

  test("ranks unknown free models by capability before release date", () => {
    const catalog = deriveModelCatalog({
      providers: [{
        id: "opencode",
        models: [
          { id: "basic", name: "Basic", free: true, releaseDate: "2026-02-01", inputModalities: ["text"] },
          {
            id: "capable",
            name: "Capable",
            free: true,
            releaseDate: "2025-01-01",
            status: "active",
            reasoning: true,
            toolCall: true,
            inputModalities: ["text", "image", "video"],
            contextLimit: 200_000,
          },
        ],
      }],
      favorites: [],
      recents: [],
      configured: [],
    })

    expect(catalog.sections.find((section) => section.kind === "free")?.items.map((item) => item.model.id)).toEqual([
      "capable",
      "basic",
    ])
  })
})

describe("deriveComposerSelection", () => {
  test("uses override, agent model, recent, then provider fallback in order", () => {
    const base = {
      providers,
      agents: [{ name: "build", mode: "primary" as const, model: { providerID: "other", modelID: "other-model" } }],
      defaultAgent: "build",
      configuredModel: { providerID: "opencode", modelID: "paid" },
      recentModels: [{ providerID: "opencode", modelID: "paid-2" }],
    }

    expect(deriveComposerSelection({ ...base, modelOverrides: { build: { providerID: "opencode", modelID: "paid-3" } } }).model).toEqual({
      providerID: "opencode",
      modelID: "paid-3",
    })
    expect(deriveComposerSelection(base).model).toEqual({ providerID: "other", modelID: "other-model" })
    expect(deriveComposerSelection({ ...base, agents: [{ name: "build", mode: "primary" as const }] }).model).toEqual({
      providerID: "opencode",
      modelID: "paid",
    })
    expect(deriveComposerSelection({ ...base, configuredModel: undefined, recentModels: [] }).model).toEqual({
      providerID: "other",
      modelID: "other-model",
    })
  })

  test("falls back through recent, provider default, then first provider model", () => {
    const base = {
      providers,
      agents: [{ name: "build", mode: "primary" as const }],
      defaultAgent: "build",
    }

    expect(deriveComposerSelection({ ...base, recentModels: [{ providerID: "opencode", modelID: "paid-2" }] }).model).toEqual({
      providerID: "opencode",
      modelID: "paid-2",
    })
    expect(deriveComposerSelection({ ...base, providerDefaults: { opencode: "paid-5" } }).model).toEqual({
      providerID: "opencode",
      modelID: "paid-5",
    })
    expect(deriveComposerSelection(base).model).toEqual({ providerID: "opencode", modelID: "free-new" })
  })

  test("skips providers that contain only deprecated models", () => {
    expect(deriveComposerSelection({
      providers: [
        { id: "retired", models: [{ id: "old", status: "deprecated" }] },
        { id: "active", models: [{ id: "current" }] },
      ],
      agents: [{ name: "build", mode: "primary" }],
      defaultAgent: "build",
    }).model).toEqual({ providerID: "active", modelID: "current" })
  })

  test("treats a persisted default variant as an explicit agent variant reset", () => {
    const model = { providerID: "opencode", modelID: "paid" }
    const base = {
      providers,
      agents: [{ name: "build", mode: "primary" as const, model, variant: "deep" }],
      defaultAgent: "build",
    }

    expect(deriveComposerSelection(base).variant).toBe("deep")
    expect(deriveComposerSelection({ ...base, modelVariants: { "opencode/paid": "fast" } }).variant).toBe("fast")
    expect(deriveComposerSelection({ ...base, modelVariants: { "opencode/paid": "default" } }).variant).toBeUndefined()
  })
})

describe("derivePendingInteraction", () => {
  test("prioritizes permission over question and running status", () => {
    expect(derivePendingInteraction({ permissions: [], questions: [], status: "running" })).toEqual({ kind: "status", status: "running" })
    expect(derivePendingInteraction({ permissions: [], questions: [{ id: "q1" }], status: "running" })).toEqual({ kind: "question", requestID: "q1" })
    expect(derivePendingInteraction({ permissions: [{ id: "p1" }], questions: [{ id: "q1" }], status: "running" })).toEqual({ kind: "permission", requestID: "p1" })
  })
})

test("isProductSessionRunning distinguishes active execution from terminal lifecycle states", () => {
  expect(["idle", "running", "retry", "aborted", "error"].map((status) => isProductSessionRunning(status as "idle" | "running" | "retry" | "aborted" | "error"))).toEqual([
    false,
    true,
    true,
    false,
    false,
  ])
})

describe("reduceProductEvent", () => {
  test("clears a previous error when a new session status arrives", () => {
    const initial: ProductSnapshot = createProductSnapshot()
    const failed = reduceProductEvent(initial, { type: "session.error", error: { message: "provider failed" } })

    expect(failed).toEqual({ ...initial, status: "error", error: { message: "provider failed" } })
    expect(reduceProductEvent(failed, { type: "session.status", status: "idle" })).toEqual(initial)
  })
})
