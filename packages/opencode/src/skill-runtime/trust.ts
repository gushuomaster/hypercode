import { FSUtil } from "@opencode-ai/core/fs-util"
import { lstat } from "fs/promises"
import path from "path"
import { Effect, Schema } from "effect"
import { isRecord } from "@/util/record"

export const Decision = Schema.Literals(["execute", "install"])
export type Decision = Schema.Schema.Type<typeof Decision>

export type Subject = {
  readonly skill: string
  readonly fingerprint: string
}

export class Error extends Schema.TaggedErrorClass<Error>()("SkillTrustError", {
  code: Schema.String,
  message: Schema.String,
}) {}

const filename = ".hypercode-trust.json"

export const check = Effect.fn("SkillTrust.check")(function* (root: string, subject: Subject, decision: Decision) {
  validate(subject)
  const grants: Grant[] = yield* read(root)
  return grants.some(
    (grant) =>
      grant.skill === subject.skill && grant.fingerprint === subject.fingerprint && grant.decisions.includes(decision),
  )
})

export const ensure = Effect.fn("SkillTrust.ensure")(function* <E, R>(
  root: string,
  subject: Subject,
  decision: Decision,
  confirm: () => Effect.Effect<boolean, E, R>,
) {
  if (yield* check(root, subject, decision)) return false
  if (!(yield* confirm())) {
    return yield* new Error({ code: "trust-rejected", message: "Executable skill trust was not approved" })
  }
  yield* approve(root, subject, decision)
  return true
})

export const approve = Effect.fn("SkillTrust.approve")(function* (
  root: string,
  subject: Subject,
  decision: Decision,
) {
  validate(subject)
  const fs = yield* FSUtil.Service
  const grants: Grant[] = yield* read(root)
  const existing = grants.find(
    (grant) => grant.skill === subject.skill && grant.fingerprint === subject.fingerprint,
  )
  const next = existing
    ? grants.map((grant) =>
        grant === existing
          ? { ...grant, decisions: Array.from(new Set([...grant.decisions, decision])).toSorted() as Decision[] }
          : grant,
      )
    : [...grants, { ...subject, decisions: [decision] }]
  yield* fs.makeDirectory(root, { recursive: true }).pipe(
    Effect.mapError(() => new Error({ code: "trust-write-failed", message: "Trust directory could not be created" })),
  )
  const target = path.join(root, filename)
  yield* assertRegularOrMissing(target)
  const temporary = `${target}.${process.pid}.${Date.now()}.tmp`
  yield* fs.writeFileString(temporary, JSON.stringify({ schema_version: 1, grants: next }, null, 2)).pipe(
    Effect.andThen(fs.rename(temporary, target)),
    Effect.catch((cause) =>
      fs.remove(temporary, { force: true }).pipe(
        Effect.ignore,
        Effect.andThen(
          Effect.fail(new Error({ code: "trust-write-failed", message: "Trust decision could not be persisted" })),
        ),
      ),
    ),
  )
})

type Grant = Subject & { decisions: Decision[] }

const read = Effect.fnUntraced(function* (root: string) {
  const fs = yield* FSUtil.Service
  const target = path.join(root, filename)
  if (!(yield* fs.existsSafe(target))) return [] as Grant[]
  yield* assertRegularOrMissing(target)
  const value = yield* fs.readJson(target).pipe(
    Effect.mapError(() => new Error({ code: "trust-invalid", message: "Trust store could not be read" })),
  )
  if (!isRecord(value) || value.schema_version !== 1 || !Array.isArray(value.grants)) {
    return yield* new Error({ code: "trust-invalid", message: "Trust store is invalid" })
  }
  const grants = value.grants as unknown[]
  return yield* Effect.try({
    try: () => grants.map(parseGrant),
    catch: (cause) =>
      cause instanceof Error ? cause : new Error({ code: "trust-invalid", message: "Trust store is invalid" }),
  })
})

function parseGrant(value: unknown): Grant {
  if (
    !isRecord(value) ||
    typeof value.skill !== "string" ||
    typeof value.fingerprint !== "string" ||
    !Array.isArray(value.decisions) ||
    value.decisions.some((decision) => decision !== "execute" && decision !== "install")
  ) {
    throw new Error({ code: "trust-invalid", message: "Trust store contains an invalid grant" })
  }
  validate({ skill: value.skill, fingerprint: value.fingerprint })
  return { skill: value.skill, fingerprint: value.fingerprint, decisions: value.decisions as Decision[] }
}

function validate(subject: Subject) {
  if (!subject.skill.trim() || !/^[a-f0-9]{64}$/.test(subject.fingerprint)) {
    throw new Error({ code: "trust-subject-invalid", message: "Trust subject is invalid" })
  }
}

const assertRegularOrMissing = Effect.fnUntraced(function* (target: string) {
  const info = yield* Effect.promise(() => lstat(target).catch(() => undefined))
  if (info?.isSymbolicLink() || (info && !info.isFile())) {
    return yield* new Error({ code: "trust-path-unsafe", message: "Trust store must be a regular file" })
  }
})

export * as SkillTrust from "./trust"
