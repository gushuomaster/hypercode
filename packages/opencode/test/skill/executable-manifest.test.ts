import { describe, expect } from "bun:test"
import { CrossSpawnSpawner } from "@opencode-ai/core/cross-spawn-spawner"
import { FSUtil } from "@opencode-ai/core/fs-util"
import path from "path"
import { Effect, Layer } from "effect"
import { ExecutableManifest } from "../../src/skill/executable-manifest"
import { tmpdirScoped } from "../fixture/fixture"
import { testEffect } from "../lib/effect"

const it = testEffect(Layer.mergeAll(FSUtil.defaultLayer, CrossSpawnSpawner.defaultLayer))

const manifest = {
  schema_version: 1,
  protocol: "executable-skill/1",
  entrypoint: ["python", "scripts/main.py"],
  runtime: {
    kind: "python",
    version: ">=3.11",
    requirements: ["requirements.txt"],
  },
  actions: ["llm.generate", "image.generate", "user.ask"],
  permissions: {
    read: ["skill", "project"],
    write: ["project"],
    process: ["python"],
  },
  protected: ["SKILL.md", "scripts/**/*.py"],
}

const setup = Effect.fnUntraced(function* () {
  const tmp = yield* tmpdirScoped()
  const fs = yield* FSUtil.Service
  yield* fs.makeDirectory(path.join(tmp, "scripts"), { recursive: true })
  yield* fs.writeFileString(path.join(tmp, "SKILL.md"), "---\nname: test\n---\nbody")
  yield* fs.writeFileString(path.join(tmp, "scripts", "main.py"), "print('ok')")
  yield* fs.writeFileString(path.join(tmp, "requirements.txt"), "")
  return tmp
})

describe("executable skill manifest", () => {
  it.live("keeps ordinary skills non-executable", () =>
    Effect.gen(function* () {
      const root = yield* setup()
      expect(yield* ExecutableManifest.load(root)).toBeUndefined()
    }),
  )

  it.live("discovers a valid manifest without executing it", () =>
    Effect.gen(function* () {
      const root = yield* setup()
      yield* (yield* FSUtil.Service).writeJson(path.join(root, "skill-runtime.json"), manifest)

      const result = yield* ExecutableManifest.load(root)

      expect(result?.protocol).toBe("executable-skill/1")
      expect(result?.entrypoint).toEqual(["python", "scripts/main.py"])
      expect(result?.actions).toEqual(["llm.generate", "image.generate", "user.ask"])
      expect(result?.protected).toEqual(["SKILL.md", "scripts/**/*.py"])
    }),
  )

  it.live("rejects unknown protocol majors and action types", () =>
    Effect.gen(function* () {
      const root = yield* setup()
      const fs = yield* FSUtil.Service
      yield* fs.writeJson(path.join(root, "skill-runtime.json"), {
        ...manifest,
        protocol: "executable-skill/2",
      })
      expect((yield* Effect.flip(ExecutableManifest.load(root))).code).toBe("protocol-version-unsupported")

      yield* fs.writeJson(path.join(root, "skill-runtime.json"), {
        ...manifest,
        actions: ["shell.run"],
      })
      expect((yield* Effect.flip(ExecutableManifest.load(root))).code).toBe("manifest-action-unsupported")
    }),
  )

  it.live("rejects absolute, parent, and drive-switch paths", () =>
    Effect.gen(function* () {
      const root = yield* setup()
      const fs = yield* FSUtil.Service
      for (const entrypoint of ["/outside.py", "../outside.py", "Z:\\outside.py"]) {
        yield* fs.writeJson(path.join(root, "skill-runtime.json"), {
          ...manifest,
          entrypoint: ["python", entrypoint],
        })
        expect((yield* Effect.flip(ExecutableManifest.load(root))).code).toBe("manifest-path-unsafe")
      }
    }),
  )

  it.live("rejects symbolic links in the entrypoint", () =>
    Effect.gen(function* () {
      const root = yield* setup()
      const fs = yield* FSUtil.Service
      yield* fs.remove(path.join(root, "scripts", "main.py"))
      const linked = yield* Effect.promise(async () => {
        try {
          await Bun.write(path.join(root, "outside.py"), "outside")
          await import("fs/promises").then((module) =>
            module.symlink(path.join(root, "outside.py"), path.join(root, "scripts", "main.py")),
          )
          return true
        } catch {
          return false
        }
      })
      if (!linked) return
      yield* fs.writeJson(path.join(root, "skill-runtime.json"), manifest)

      expect((yield* Effect.flip(ExecutableManifest.load(root))).code).toBe("manifest-path-unsafe")
    }),
  )
})
