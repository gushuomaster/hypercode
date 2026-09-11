import { Context, Effect, Layer } from "effect"
import { LayerNode } from "@opencode-ai/core/effect/layer-node"
import { Capability } from "./schema"

export type Result = Capability.Identity & {
  readonly healthy: boolean
  readonly reason?: string
}

export type Failure = Capability.Identity & {
  readonly reason: string
  readonly retryable: boolean
}

export interface Interface {
  readonly get: (candidate: Capability.Identity) => Effect.Effect<Result>
  readonly succeed: (candidate: Capability.Identity) => Effect.Effect<void>
  readonly fail: (failure: Failure) => Effect.Effect<void>
}

export class Service extends Context.Service<Service, Interface>()("@opencode/CapabilityModelHealth") {}

export const layer = Layer.sync(Service, () => {
  const failures = new Map<string, { count: number; reason: string; blockedUntil: number }>()
  const get = Effect.fn("CapabilityModelHealth.get")((candidate: Capability.Identity) =>
    Effect.sync(() => {
      const failure = failures.get(Capability.identity(candidate))
      return {
        ...candidate,
        healthy: !failure || failure.blockedUntil <= Date.now(),
        ...(failure ? { reason: failure.reason } : {}),
      }
    }),
  )
  const succeed = Effect.fn("CapabilityModelHealth.succeed")((candidate: Capability.Identity) =>
    Effect.sync(() => {
      failures.delete(Capability.identity(candidate))
    }),
  )
  const fail = Effect.fn("CapabilityModelHealth.fail")((failure: Failure) =>
    Effect.sync(() => {
      if (!failure.retryable) return
      const previous = failures.get(Capability.identity(failure))
      const count = (previous?.count ?? 0) + 1
      failures.set(Capability.identity(failure), {
        count,
        reason: failure.reason,
        blockedUntil: count >= 3 ? Date.now() + Math.min(5 * 60_000, 10_000 * 2 ** (count - 3)) : 0,
      })
    }),
  )
  return Service.of({ get, succeed, fail })
})

export const node = LayerNode.make(layer, [])

export * as CapabilityModelHealth from "./model-health"
