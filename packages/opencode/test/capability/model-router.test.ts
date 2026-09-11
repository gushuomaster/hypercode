import { describe, expect, it } from "bun:test"
import { Effect } from "effect"
import { Capability } from "../../src/capability/schema"
import { CapabilityModelRouter } from "../../src/capability/model-router"

const requirements = Capability.decodeRequirements({
  input: ["text", "image"],
  output: ["text"],
  structured_output: true,
  tools: true,
  min_context: 32_000,
})

const policy: Capability.Policy = {
  confirmedModels: ["alpha/a", "beta/b", "gamma/c"],
  order: [],
  cost: "free-first",
}

const candidate = (
  providerID: string,
  modelID: string,
  input: Partial<Capability.Candidate> = {},
): Capability.Candidate => ({
  providerID,
  modelID,
  capabilities: {
    input: ["text", "image"],
    output: ["text"],
    structuredOutput: true,
    tools: true,
  },
  context: 128_000,
  cost: "free",
  credentialAvailable: true,
  healthy: true,
  quality: "balanced",
  latency: "interactive",
  ...input,
})

describe("capability model router", () => {
  it("selects a deterministic candidate when the action omits provider and model", () => {
    const snapshot = CapabilityModelRouter.createSnapshot(
      requirements,
      [candidate("beta", "b"), candidate("alpha", "a")],
      policy,
      new Date("2026-09-04T00:00:00.000Z"),
    )
    expect(snapshot.createdAt).toBe("2026-09-04T00:00:00.000Z")
    expect(snapshot.candidates.map(Capability.identity)).toEqual(["alpha/a", "beta/b"])
  })

  it("does not let skill requirements bypass credential or cost policy", () => {
    expect(() => Capability.decodeRequirements({ cost: "paid", credential_available: true })).toThrow(
      "unsupported fields",
    )
    const requestedPaid = Capability.decodeRequirements({ provider: "beta", model: "b" })
    const snapshot = CapabilityModelRouter.createSnapshot(
      requestedPaid,
      [
        candidate("alpha", "a"),
        candidate("beta", "b", { cost: "paid" }),
        candidate("gamma", "c", { credentialAvailable: false }),
      ],
      policy,
    )
    expect(snapshot.candidates.map(Capability.identity)).toEqual(["alpha/a", "beta/b"])
    expect(
      CapabilityModelRouter.createSnapshot(requestedPaid, [candidate("beta", "b", { cost: "paid" })], {
        ...policy,
        cost: "free-only",
      }).candidates,
    ).toEqual([])
  })

  it("excludes the primary identity for independent review", () => {
    const snapshot = CapabilityModelRouter.createSnapshot(
      Capability.decodeRequirements({ independent_of: ["alpha/a"] }),
      [candidate("alpha", "a"), candidate("beta", "b")],
      policy,
    )
    expect(snapshot.candidates.map(Capability.identity)).toEqual(["beta/b"])
  })

  it("routes image action requirements through capabilities instead of a named pool", () => {
    const image = candidate("image-provider", "image-model", {
      capabilities: { input: ["text", "image"], output: ["image"], structuredOutput: false, tools: false },
    })
    const text = candidate("text-provider", "text-model")
    const snapshot = CapabilityModelRouter.createSnapshot(
      Capability.decodeRequirements({ input: ["text", "image"], output: ["image"] }),
      [text, image],
      { ...policy, confirmedModels: ["image-provider/image-model"] },
    )
    expect(snapshot.candidates.map(Capability.identity)).toEqual(["image-provider/image-model"])
  })

  it("uses generic first-use and paid confirmations", async () => {
    const confirmations: Capability.Confirmation[] = []
    const selected = await Effect.runPromise(
      CapabilityModelRouter.authorize(
        CapabilityModelRouter.createSnapshot(requirements, [candidate("delta", "paid", { cost: "paid" })], {
          ...policy,
          confirmedModels: [],
          cost: "allow-paid",
        }),
        { ...policy, confirmedModels: [], cost: "allow-paid" },
        (confirmation) => Effect.sync(() => (confirmations.push(confirmation), true)),
      ),
    )
    expect(Capability.identity(selected)).toBe("delta/paid")
    expect(confirmations.map((item) => item.kind)).toEqual(["model-first-use", "paid-use"])
    expect(confirmations.every((item) => !item.message.toLowerCase().includes("video"))).toBe(true)
    expect(confirmations.every((item) => !item.message.includes("视频"))).toBe(true)
  })
})
