import { describe, expect } from "bun:test"
import { Effect, Schema } from "effect"
import { CommandV2 } from "@opencode-ai/core/command"
import { AppNodeBuilder } from "@opencode-ai/core/effect/app-node-builder"
import { ModelV2 } from "@opencode-ai/core/model"
import { ProviderV2 } from "@opencode-ai/core/provider"
import { testEffect } from "./lib/effect"

const it = testEffect(AppNodeBuilder.build(CommandV2.node))

describe("CommandV2", () => {
  it.effect("decodes localized descriptions while preserving legacy descriptions", () =>
    Effect.sync(() => {
      const decode = Schema.decodeUnknownSync(CommandV2.Info)
      expect(
        decode({
          name: "review",
          template: "Review files",
          description: "File review",
          description_i18n: {
            zh: "审查文件",
            en: "File review",
          },
        }),
      ).toHaveProperty("description_i18n", {
        zh: "审查文件",
        en: "File review",
      })
      expect(
        decode({
          name: "legacy",
          template: "Legacy command",
          description: "Legacy description",
        }),
      ).toEqual(
        CommandV2.Info.make({
          name: "legacy",
          template: "Legacy command",
          description: "Legacy description",
        }),
      )
    }),
  )

  it.effect("applies command transforms and preserves later overrides", () =>
    Effect.gen(function* () {
      const command = yield* CommandV2.Service
      yield* command.transform((editor) => {
        editor.update("review", (command) => {
          command.template = "First"
          command.description = "Review code"
        })
        editor.update("review", (command) => {
          command.template = "Second"
          command.model = {
            id: ModelV2.ID.make("claude"),
            providerID: ProviderV2.ID.make("anthropic"),
            variant: ModelV2.VariantID.make("high"),
          }
        })
      })

      expect(yield* command.get("review")).toEqual(
        CommandV2.Info.make({
          name: "review",
          template: "Second",
          description: "Review code",
          model: {
            id: ModelV2.ID.make("claude"),
            providerID: ProviderV2.ID.make("anthropic"),
            variant: ModelV2.VariantID.make("high"),
          },
        }),
      )
      expect(yield* command.list()).toEqual([
        CommandV2.Info.make({
          name: "review",
          template: "Second",
          description: "Review code",
          model: {
            id: ModelV2.ID.make("claude"),
            providerID: ProviderV2.ID.make("anthropic"),
            variant: ModelV2.VariantID.make("high"),
          },
        }),
      ])
    }),
  )
})
