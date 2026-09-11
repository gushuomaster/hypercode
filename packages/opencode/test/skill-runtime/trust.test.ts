import { describe, expect } from "bun:test"
import { CrossSpawnSpawner } from "@opencode-ai/core/cross-spawn-spawner"
import { FSUtil } from "@opencode-ai/core/fs-util"
import path from "path"
import { Effect, Layer } from "effect"
import { SkillTrust } from "../../src/skill-runtime/trust"
import { tmpdirScoped } from "../fixture/fixture"
import { testEffect } from "../lib/effect"

const it = testEffect(Layer.mergeAll(FSUtil.defaultLayer, CrossSpawnSpawner.defaultLayer))
const subject = { skill: "example-skill", fingerprint: "a".repeat(64) }

describe("skill runtime trust", () => {
  it.live("checks trust without writing during read-only discovery", () =>
    Effect.gen(function* () {
      const parent = yield* tmpdirScoped()
      const root = path.join(parent, "runtime")

      expect(yield* SkillTrust.check(root, subject, "execute")).toBe(false)
      expect(yield* (yield* FSUtil.Service).existsSafe(root)).toBe(false)
    }),
  )

  it.live("reuses approval only for the same fingerprint and decision", () =>
    Effect.gen(function* () {
      const root = path.join(yield* tmpdirScoped(), "runtime")
      yield* SkillTrust.approve(root, subject, "execute")

      expect(yield* SkillTrust.check(root, subject, "execute")).toBe(true)
      expect(yield* SkillTrust.check(root, subject, "install")).toBe(false)
      expect(yield* SkillTrust.check(root, { ...subject, fingerprint: "b".repeat(64) }, "execute")).toBe(false)
    }),
  )

  it.live("keeps dependency installation as a separate approval", () =>
    Effect.gen(function* () {
      const root = path.join(yield* tmpdirScoped(), "runtime")
      yield* SkillTrust.approve(root, subject, "execute")
      yield* SkillTrust.approve(root, subject, "install")

      expect(yield* SkillTrust.check(root, subject, "execute")).toBe(true)
      expect(yield* SkillTrust.check(root, subject, "install")).toBe(true)
    }),
  )

  it.live("asks once through an injected confirmation lifecycle", () =>
    Effect.gen(function* () {
      const root = path.join(yield* tmpdirScoped(), "runtime")
      let confirmations = 0
      const confirm = () => Effect.sync(() => (++confirmations, true))

      expect(yield* SkillTrust.ensure(root, subject, "execute", confirm)).toBe(true)
      expect(yield* SkillTrust.ensure(root, subject, "execute", confirm)).toBe(false)
      expect(confirmations).toBe(1)
    }),
  )
})
