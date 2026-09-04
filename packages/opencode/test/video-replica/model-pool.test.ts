import { describe, expect, it } from "bun:test"
import {
  discoverCandidates,
  discover,
  exhausted,
  freeze,
  nextAfterFailure,
  nextAfterFailureDecision,
  initialDecision,
  type ModelPoolConfig,
} from "@/video-replica/model-pool"
import type { ModelsDev } from "@opencode-ai/core/models-dev"
import { checkHealth, probeEndpoint } from "@/video-replica/model-health"

const model = (id: string, overrides: Record<string, unknown> = {}) =>
  ({
    id,
    name: id,
    release_date: "2026-01-01",
    attachment: false,
    reasoning: false,
    temperature: true,
    tool_call: true,
    cost: { input: 0, output: 0 },
    limit: { context: 128000, output: 8192 },
    modalities: { input: ["text", "image", "video"], output: ["text"] },
    ...overrides,
  }) as unknown as ModelsDev.Model

const config: ModelPoolConfig = {
  providers: ["nvidia"],
  confirmedModels: [],
}

describe("video replica model pool", () => {
  it("filters deprecated, paid, modality-incompatible models and marks new models pending confirmation", () => {
    const catalog = {
      nvidia: {
        id: "nvidia",
        name: "NVIDIA",
        env: [],
        models: {
          "muse-spark-1.2-contributor-free": model("muse-spark-1.2-contributor-free"),
          deprecated: model("deprecated", { status: "deprecated" }),
          paid: model("paid", { cost: { input: 1, output: 1 } }),
          imageOnly: model("imageOnly", { modalities: { input: ["image"], output: ["image"] } }),
        },
      },
      openai: {
        id: "openai",
        name: "OpenAI",
        env: [],
        models: { outsider: model("outsider") },
      },
    } as unknown as Record<string, ModelsDev.Provider>

    expect(discoverCandidates(catalog, config)).toEqual([
      {
        providerID: "nvidia",
        modelID: "muse-spark-1.2-contributor-free",
        kind: "orchestration",
        requiresConfirmation: true,
      },
    ])
  })

  it("freezes a task snapshot and switches only within the same pool", () => {
    const pool = {
      orchestration: [
        { providerID: "a", modelID: "one", kind: "orchestration" as const, requiresConfirmation: false },
        { providerID: "b", modelID: "two", kind: "orchestration" as const, requiresConfirmation: false },
      ],
      image: [{ providerID: "a", modelID: "img", kind: "image" as const, requiresConfirmation: false }],
    }
    const snapshot = freeze(pool)
    pool.orchestration.push({ providerID: "c", modelID: "three", kind: "orchestration", requiresConfirmation: false })
    expect(snapshot.orchestration).toHaveLength(2)
    expect(nextAfterFailure(snapshot, snapshot.orchestration[0])).toEqual(snapshot.orchestration[1])
    expect(nextAfterFailure(snapshot, snapshot.orchestration.at(-1)!)).toBeUndefined()
  })

  it("returns an explicit exhaustion result", () => {
    expect(exhausted("orchestration")).toMatchObject({ exhausted: true, pool: "orchestration" })
  })

  it("keeps image candidates even when tool calling is unavailable", () => {
    const catalog = {
      nvidia: {
        id: "nvidia",
        name: "NVIDIA",
        env: [],
        models: {
          image: model("qwen/qwen-image-edit", {
            tool_call: false,
            modalities: { input: ["text", "image"], output: ["image"] },
          }),
          dual: model("dual", { tool_call: false, modalities: { input: ["text", "image", "video"], output: ["text", "image"] } }),
        },
      },
    } as unknown as Record<string, ModelsDev.Provider>
    expect(discoverCandidates(catalog, config).find((candidate) => candidate.modelID === "qwen/qwen-image-edit")).toMatchObject({ kind: "image" })
    expect(discoverCandidates(catalog, config).find((candidate) => candidate.modelID === "dual")).toMatchObject({ kind: "image" })
  })

  it("removes unhealthy candidates during discovery", async () => {
    const catalog = {
      nvidia: {
        id: "nvidia",
        name: "NVIDIA",
        env: [],
        models: { one: model("one"), two: model("two"), thrower: model("thrower"), cachePaid: model("cachePaid", { cost: { input: 0, output: 0, cache_read: 1 } }) },
      },
    } as unknown as Record<string, ModelsDev.Provider>
    const snapshot = await discover(catalog, {
      ...config,
      healthProbe: ({ modelID }) => { if (modelID === "thrower") throw new Error("probe failure"); return modelID === "one" },
    })
    expect(snapshot.orchestration.map((candidate) => candidate.modelID)).toEqual(["one"])
  })

  it("requires full orchestration modalities and rejects unknown statuses", () => {
    const catalog = {
      nvidia: {
        id: "nvidia", name: "NVIDIA", env: [], models: {
          valid: model("valid", { modalities: { input: ["text", "image", "video"], output: ["text"] }, status: "active" }),
          legacy: model("legacy", { modalities: { input: ["text", "image", "video"], output: ["text"] } }),
          textOnly: model("textOnly", { modalities: { input: ["text"], output: ["text"] } }),
          alpha: model("alpha", { modalities: { input: ["text", "image", "video"], output: ["text"] }, status: "alpha" }),
          beta: model("beta", { modalities: { input: ["text", "image", "video"], output: ["text"] }, status: "beta" }),
          unknown: model("unknown", { modalities: { input: ["text", "image", "video"], output: ["text"] }, status: "other" }),
        },
      },
    } as unknown as Record<string, ModelsDev.Provider>
    expect(discoverCandidates(catalog, { providers: ["nvidia"] }).map((candidate) => candidate.modelID)).toEqual(["legacy", "valid"])
  })

  it("requires health probe and confirmation before failover", async () => {
    const catalog = {
      nvidia: {
        id: "nvidia", name: "NVIDIA", env: [], models: { one: model("one"), two: model("two") },
      },
    } as unknown as Record<string, ModelsDev.Provider>
    const noProbe = await discover(catalog, { providers: ["nvidia"] })
    expect(noProbe.orchestration).toHaveLength(0)
    const snapshot = freeze({
      orchestration: [
        { providerID: "nvidia", modelID: "one", kind: "orchestration" as const, requiresConfirmation: false },
        { providerID: "nvidia", modelID: "two", kind: "orchestration" as const, requiresConfirmation: true },
      ],
      image: [],
    })
    expect(nextAfterFailure(snapshot, snapshot.orchestration[0])).toBeUndefined()
    expect(nextAfterFailureDecision(snapshot, snapshot.orchestration[0])).toMatchObject({ requiresConfirmation: true, skipped: [snapshot.orchestration[1]] })
    expect(initialDecision(snapshot, "orchestration")).toMatchObject({ candidate: snapshot.orchestration[0] })
    const gated = freeze({ orchestration: [snapshot.orchestration[1], snapshot.orchestration[0]], image: [] })
    expect(initialDecision(gated, "orchestration")).toMatchObject({ candidate: undefined, skipped: [], requiresConfirmation: true })
  })

  it("allows explicit image ordering to override qwen and flux defaults", () => {
    const catalog = {
      nvidia: {
        id: "nvidia", name: "NVIDIA", env: [], models: {
          "qwen/qwen-image-edit": model("qwen/qwen-image-edit", { tool_call: false, modalities: { input: ["text", "image"], output: ["image"] } }),
          "black-forest-labs/flux_1-kontext-dev": model("black-forest-labs/flux_1-kontext-dev", { tool_call: false, modalities: { input: ["text", "image"], output: ["image"] } }),
        },
      },
    } as unknown as Record<string, ModelsDev.Provider>
    const defaults = discoverCandidates(catalog, { providers: ["nvidia"] })
    expect(defaults.map((candidate) => candidate.modelID)).toEqual(["qwen/qwen-image-edit", "black-forest-labs/flux_1-kontext-dev"])
    const result = discoverCandidates(catalog, { providers: ["nvidia"], imageOrder: ["black-forest-labs/flux_1-kontext-dev", "qwen/qwen-image-edit"] })
    expect(result.map((candidate) => candidate.modelID)).toEqual(["black-forest-labs/flux_1-kontext-dev", "qwen/qwen-image-edit"])
  })

  it("reports attempted candidates and confirmation requirements on exhaustion", () => {
    expect(exhausted("image", ["nvidia/qwen/qwen-image-edit"], true)).toMatchObject({
      pool: "image",
      attempted: ["nvidia/qwen/qwen-image-edit"],
      paidConfirmationRequired: true,
    })
    expect(exhausted("image", [], false).paidConfirmationRequired).toBe(true)
  })

  it("preserves structured health probe evidence", async () => {
    await expect(
      checkHealth([{ providerID: "nvidia", modelID: "one" }], async () => ({ healthy: false, reason: "credential rejected" })),
    ).resolves.toEqual([{ providerID: "nvidia", modelID: "one", healthy: false, reason: "credential rejected" }])
  })

  it("probes an endpoint with a bodyless HEAD request", async () => {
    let method = ""
    let body: unknown = "unset"
    const server = Bun.serve({
      port: 0,
      fetch: async (request) => {
        method = request.method
        body = await request.text()
        return new Response("", { status: 401 })
      },
    })
    try {
      await expect(probeEndpoint(server.url.toString())).resolves.toMatchObject({ healthy: true, status: 401 })
      expect(method).toBe("HEAD")
      expect(body).toBe("")
    } finally {
      server.stop(true)
    }
  })
})
