import { describe, expect } from "bun:test"
import { CrossSpawnSpawner } from "@opencode-ai/core/cross-spawn-spawner"
import { FSUtil } from "@opencode-ai/core/fs-util"
import path from "path"
import { Effect, Layer } from "effect"
import { ExecutableManifest } from "../../src/skill/executable-manifest"
import { SkillFingerprint } from "../../src/skill-runtime/fingerprint"
import { tmpdirScoped } from "../fixture/fixture"
import { testEffect } from "../lib/effect"

const it = testEffect(Layer.mergeAll(FSUtil.defaultLayer, CrossSpawnSpawner.defaultLayer))

const setup = Effect.fnUntraced(function* () {
  const root = yield* tmpdirScoped()
  const fs = yield* FSUtil.Service
  yield* fs.makeDirectory(path.join(root, "scripts"), { recursive: true })
  yield* fs.makeDirectory(path.join(root, "references"), { recursive: true })
  yield* fs.writeFileString(path.join(root, "SKILL.md"), "instructions")
  yield* fs.writeFileString(path.join(root, "skill-runtime.json"), "manifest")
  yield* fs.writeFileString(path.join(root, "requirements.txt"), "pillow")
  yield* fs.writeFileString(path.join(root, "scripts", "main.py"), "print('ok')")
  yield* fs.writeFileString(path.join(root, "scripts", "helper.py"), "VALUE = 1")
  yield* fs.writeFileString(path.join(root, "references", "protocol.md"), "contract")
  const manifest = {
    schemaVersion: 1,
    protocol: "executable-skill/1",
    entrypoint: ["python", "scripts/main.py"],
    runtime: { kind: "python", version: ">=3.11", requirements: ["requirements.txt"] },
    actions: ["llm.generate", "image.generate", "user.ask"],
    permissions: { read: ["skill", "project"], write: ["project"], process: ["python"] },
    protected: ["scripts/**/*.py", "references/**/*.md"],
  } satisfies ExecutableManifest.Manifest
  return { root, manifest }
})

describe("skill runtime fingerprint", () => {
  it.live("is stable and covers declared executable files", () =>
    Effect.gen(function* () {
      const fixture = yield* setup()
      const first = yield* SkillFingerprint.calculate(fixture.root, fixture.manifest)
      const second = yield* SkillFingerprint.calculate(fixture.root, fixture.manifest)

      expect(first).toEqual(second)
      expect(first.files.map((file) => file.path)).toEqual([
        "SKILL.md",
        "references/protocol.md",
        "requirements.txt",
        "scripts/helper.py",
        "scripts/main.py",
        "skill-runtime.json",
      ])
    }),
  )

  it.live("changes when any protected file changes", () =>
    Effect.gen(function* () {
      const fixture = yield* setup()
      const first = yield* SkillFingerprint.calculate(fixture.root, fixture.manifest)
      yield* (yield* FSUtil.Service).writeFileString(path.join(fixture.root, "references", "protocol.md"), "changed")
      const second = yield* SkillFingerprint.calculate(fixture.root, fixture.manifest)

      expect(second.value).not.toBe(first.value)
    }),
  )

  it.live("rejects symbolic links in protected paths", () =>
    Effect.gen(function* () {
      const fixture = yield* setup()
      const fs = yield* FSUtil.Service
      yield* fs.remove(path.join(fixture.root, "scripts", "helper.py"))
      const linked = yield* Effect.promise(async () => {
        try {
          await Bun.write(path.join(fixture.root, "outside.py"), "outside")
          await import("fs/promises").then((module) =>
            module.symlink(path.join(fixture.root, "outside.py"), path.join(fixture.root, "scripts", "helper.py")),
          )
          return true
        } catch {
          return false
        }
      })
      if (!linked) return

      expect((yield* Effect.flip(SkillFingerprint.calculate(fixture.root, fixture.manifest))).code).toBe(
        "fingerprint-path-unsafe",
      )
    }),
  )
})
