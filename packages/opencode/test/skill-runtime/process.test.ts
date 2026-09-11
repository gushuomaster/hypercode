import { describe, expect } from "bun:test"
import { AppProcess } from "@opencode-ai/core/process"
import path from "path"
import { Context, Effect, Exit, Fiber, Layer, Scope } from "effect"
import { SkillProcess } from "../../src/skill-runtime/process"
import { SkillProtocol } from "../../src/skill-runtime/protocol"
import { SkillRuntime } from "../../src/skill-runtime/service"
import { testEffect } from "../lib/effect"

const it = testEffect(AppProcess.defaultLayer)
const root = path.resolve(import.meta.dirname, "../fixture/executable-skill")

const request = (mode = "valid"): SkillProtocol.Request => ({
  protocol_version: "1.0",
  request_id: `request-${mode}`,
  command: "status",
  project_directory: process.cwd(),
  payload: { fixture_mode: mode },
})

const invoke = (mode = "valid", input?: Partial<SkillProcess.Input>) =>
  SkillProcess.invoke({
    skillRoot: root,
    python: "python",
    entrypoint: "scripts/main.py",
    actions: ["llm.generate", "image.generate", "user.ask"],
    request: request(mode),
    ...input,
  })

describe("executable skill process", () => {
  it.live("runs one request and accepts exactly one response", () =>
    Effect.gen(function* () {
      const result = yield* invoke()
      expect(result.response.request_id).toBe("request-valid")
      expect(result.response.ready_actions[0].type).toBe("user.ask")
    }),
  )

  it.live("rejects malformed and noisy stdout", () =>
    Effect.gen(function* () {
      expect((yield* Effect.flip(invoke("malformed"))).code).toBe("protocol-response-invalid-json")
      expect((yield* Effect.flip(invoke("extra_stdout"))).code).toBe("protocol-response-invalid-json")
    }),
  )

  it.live("filters stderr diagnostics and non-zero exits", () =>
    Effect.gen(function* () {
      const warning = yield* invoke("stderr")
      expect(warning.diagnostics).toContain("[REDACTED]")
      expect(warning.diagnostics).not.toContain("top-secret")

      const failure = yield* Effect.flip(invoke("exit"))
      expect(failure.code).toBe("process-exit-nonzero")
      expect(failure.diagnostics).toContain("[REDACTED]")
      expect(failure.diagnostics).not.toContain("top-secret")
    }),
  )

  it.live("maps timeout, oversized output, and unsupported versions", () =>
    Effect.gen(function* () {
      expect((yield* Effect.flip(invoke("timeout", { timeout: "100 millis" }))).code).toBe("process-timeout")
      expect((yield* Effect.flip(invoke("large"))).code).toBe("protocol-response-too-large")
      expect((yield* Effect.flip(invoke("bad_version"))).code).toBe("protocol-version-unsupported")
    }),
    10_000,
  )

  it.live("passes only a safe environment to the skill process", () =>
    Effect.acquireUseRelease(
      Effect.sync(() => {
        const openai = process.env.OPENAI_API_KEY
        const oauth = process.env.OAUTH_TOKEN
        process.env.OPENAI_API_KEY = "provider-secret"
        process.env.OAUTH_TOKEN = "oauth-secret"
        return { openai, oauth }
      }),
      () =>
        Effect.gen(function* () {
          const result = yield* invoke()
          expect(result.response.artifacts).toEqual([{ has_openai_key: false, has_oauth_token: false }])
          expect(JSON.stringify(result)).not.toContain("provider-secret")
          expect(JSON.stringify(result)).not.toContain("oauth-secret")
        }),
      (previous) =>
        Effect.sync(() => {
          process.env.OPENAI_API_KEY = previous.openai
          process.env.OAUTH_TOKEN = previous.oauth
        }),
    ),
  )

  it.live("rejects action types not declared by the manifest", () =>
    Effect.gen(function* () {
      expect((yield* Effect.flip(invoke("valid", { actions: ["llm.generate"] }))).code).toBe(
        "protocol-action-undeclared",
      )
    }),
  )

  it.live("returns a stale revision as the skill-owned structured error", () =>
    Effect.gen(function* () {
      const result = yield* invoke("stale_revision")
      expect(result.response.status).toBe("failed")
      expect(result.response.error).toEqual({ code: "stale-revision", message: "fixture owns this conflict" })
    }),
  )

  it.live("interrupts only processes owned by the disposed runtime scope", () =>
    Effect.gen(function* () {
      const firstScope = yield* Scope.make()
      const secondScope = yield* Scope.make()
      const first = Context.get(
        yield* Layer.buildWithScope(Layer.fresh(SkillRuntime.defaultLayer), firstScope),
        SkillRuntime.Service,
      )
      const second = Context.get(
        yield* Layer.buildWithScope(Layer.fresh(SkillRuntime.defaultLayer), secondScope),
        SkillRuntime.Service,
      )
      const running = yield* first.invoke({
        skillRoot: root,
        python: "python",
        entrypoint: "scripts/main.py",
        actions: ["user.ask"],
        request: request("timeout"),
        timeout: "10 seconds",
      }).pipe(Effect.exit, Effect.forkChild)
      yield* Effect.sleep("150 millis")
      yield* Scope.close(firstScope, Exit.void)

      const unaffected = yield* second.invoke({
        skillRoot: root,
        python: "python",
        entrypoint: "scripts/main.py",
        actions: ["user.ask"],
        request: request(),
      })
      expect(unaffected.response.request_id).toBe("request-valid")
      expect(Exit.isFailure(yield* Fiber.join(running))).toBe(true)
      yield* Scope.close(secondScope, Exit.void)
    }),
    10_000,
  )
})
