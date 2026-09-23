import type { ProductAgent, ProductProvider } from "../../src"

export const rawProviders = [{
  id: "opencode",
  name: "HyperCode Zen",
  models: {
    free: {
      id: "free",
      name: "Free",
      cost: { input: 0 },
      release_date: "2026-01-01",
      status: "active",
      variants: { fast: {} },
      reasoning: true,
      tool_call: true,
      modalities: { input: ["text", "image"] },
      limit: { context: 200_000 },
    },
    unpriced: {
      id: "unpriced",
      name: "Unpriced",
    },
  },
}]

export const productProviders: ProductProvider[] = [{
  id: "opencode",
  name: "HyperCode Zen",
  models: [{
    id: "free",
    name: "Free",
    free: true,
    releaseDate: "2026-01-01",
    status: "active",
    variants: { fast: {} },
    reasoning: true,
    toolCall: true,
    inputModalities: ["text", "image"],
    contextLimit: 200_000,
  }, {
    id: "unpriced",
    name: "Unpriced",
    free: true,
    releaseDate: undefined,
    status: undefined,
    variants: undefined,
    reasoning: undefined,
    toolCall: undefined,
    inputModalities: undefined,
    contextLimit: undefined,
  }],
}]

export const rawAgents = [{
  name: "build",
  mode: "primary" as const,
  model: { providerID: "opencode", modelID: "free" },
  variant: "fast",
}]

export const productAgents: ProductAgent[] = [{
  name: "build",
  mode: "primary",
  model: { providerID: "opencode", modelID: "free" },
  variant: "fast",
}]
