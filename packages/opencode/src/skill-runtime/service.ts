import { AppProcess } from "@opencode-ai/core/process"
import { Context, Effect, Layer } from "effect"
import { LayerNode } from "@opencode-ai/core/effect/layer-node"
import { SkillProcess } from "./process"

export interface Interface {
  readonly invoke: (input: SkillProcess.Input) => Effect.Effect<SkillProcess.Output, SkillProcess.Error>
}

export class Service extends Context.Service<Service, Interface>()("@opencode/SkillRuntime") {}

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const appProcess = yield* AppProcess.Service
    const active = new Set<AbortController>()
    yield* Effect.addFinalizer(() =>
      Effect.sync(() => {
        active.forEach((controller) => controller.abort())
        active.clear()
      }),
    )

    const invoke = Effect.fn("SkillRuntime.invoke")(function* (input: SkillProcess.Input) {
      const controller = new AbortController()
      active.add(controller)
      return yield* SkillProcess.invoke({ ...input, signal: controller.signal }).pipe(
        Effect.provideService(AppProcess.Service, appProcess),
        Effect.ensuring(Effect.sync(() => active.delete(controller))),
      )
    })

    return Service.of({ invoke })
  }),
)

export const defaultLayer = layer.pipe(Layer.provide(AppProcess.defaultLayer))
export const node = LayerNode.make(layer, [AppProcess.node])

export * as SkillRuntime from "./service"
