import { AppProcess } from "@opencode-ai/core/process"
import path from "path"
import { Duration, Effect, Schema } from "effect"
import { ChildProcess } from "effect/unstable/process"
import { SkillEnvironment } from "./environment"
import { SkillProtocol } from "./protocol"
import type { ExecutableManifest } from "@/skill/executable-manifest"

export type Input = {
  readonly skillRoot: string
  readonly python: string
  readonly entrypoint: string
  readonly actions: ReadonlyArray<ExecutableManifest.ActionType>
  readonly request: SkillProtocol.Request
  readonly timeout?: Duration.Input
  readonly signal?: AbortSignal
}

export type Output = {
  readonly response: SkillProtocol.Response
  readonly diagnostics?: string
}

export class Error extends Schema.TaggedErrorClass<Error>()("SkillProcessError", {
  code: Schema.String,
  message: Schema.String,
  diagnostics: Schema.optional(Schema.String),
}) {}

export const invoke = Effect.fn("SkillProcess.invoke")(function* (input: Input) {
  const appProcess = yield* AppProcess.Service
  const request = yield* Effect.try({
    try: () => SkillProtocol.encodeRequest(input.request),
    catch: (cause) =>
      cause instanceof SkillProtocol.Error
        ? new Error({ code: cause.code, message: cause.message })
        : new Error({ code: "protocol-request-invalid", message: "Protocol request could not be encoded" }),
  })
  const env = {
    ...SkillEnvironment.processEnvironment(process.env),
    PYTHONIOENCODING: "utf-8",
    PYTHONUTF8: "1",
  }
  const result = yield* appProcess
    .run(
      ChildProcess.make(input.python, [path.join(input.skillRoot, input.entrypoint)], {
        cwd: input.skillRoot,
        env,
        extendEnv: false,
        stdin: "pipe",
      }),
      {
        stdin: request,
        signal: input.signal,
        timeout: input.timeout ?? "2 minutes",
        maxOutputBytes: SkillProtocol.MAX_RESPONSE_BYTES + 1,
        maxErrorBytes: SkillProtocol.MAX_DIAGNOSTIC_BYTES,
      },
    )
    .pipe(
      Effect.mapError((cause) =>
        new Error({
          code: input.signal?.aborted ? "process-cancelled" : timedOut(cause) ? "process-timeout" : "process-failed",
          message: input.signal?.aborted
            ? "Executable skill was cancelled"
            : timedOut(cause)
              ? "Executable skill timed out"
              : "Executable skill could not be started",
        }),
      ),
    )
  const diagnostics = SkillEnvironment.redact(result.stderr.toString("utf8")).trim() || undefined
  if (result.stdoutTruncated) {
    return yield* new Error({ code: "protocol-response-too-large", message: "Protocol response exceeds the size limit", diagnostics })
  }
  if (result.exitCode !== 0) {
    return yield* new Error({
      code: "process-exit-nonzero",
      message: `Executable skill exited with code ${result.exitCode}`,
      diagnostics,
    })
  }
  const response = yield* Effect.try({
    try: () => SkillProtocol.decodeResponse(result.stdout.toString("utf8")),
    catch: (cause) =>
      cause instanceof SkillProtocol.Error
        ? new Error({ code: cause.code, message: cause.message, diagnostics })
        : new Error({ code: "protocol-response-invalid", message: "Protocol response is invalid", diagnostics }),
  })
  if (response.request_id !== input.request.request_id) {
    return yield* new Error({ code: "protocol-request-mismatch", message: "Protocol response request_id does not match" })
  }
  const undeclared = response.ready_actions.find((action) => !input.actions.includes(action.type))
  if (undeclared) {
    return yield* new Error({
      code: "protocol-action-undeclared",
      message: `Executable skill returned undeclared action type: ${undeclared.type}`,
    })
  }
  return { response, diagnostics } satisfies Output
})

function timedOut(cause: AppProcess.AppProcessError) {
  return cause.cause instanceof globalThis.Error && cause.cause.message === "Timed out"
}

export * as SkillProcess from "./process"
