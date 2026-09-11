import path from "path"
import { Schema } from "effect"
import { isRecord } from "@/util/record"
import type { ExecutableManifest } from "@/skill/executable-manifest"

export const MAX_REQUEST_BYTES = 1024 * 1024
export const MAX_RESPONSE_BYTES = 4 * 1024 * 1024
export const MAX_DIAGNOSTIC_BYTES = 64 * 1024

export type Command = "start" | "advance" | "submit_result" | "submit_answer" | "cancel" | "status"

export type Request = {
  readonly protocol_version: "1.0"
  readonly request_id: string
  readonly command: Command
  readonly project_directory: string
  readonly workflow_id?: string
  readonly expected_revision?: number
  readonly payload: Record<string, unknown>
}

export type Action = {
  readonly operation_id: string
  readonly type: ExecutableManifest.ActionType
  readonly depends_on: ReadonlyArray<string>
  readonly requirements: Record<string, unknown>
  readonly payload: Record<string, unknown>
}

export type Response = {
  readonly protocol_version: string
  readonly request_id: string | null
  readonly workflow_id: string | null
  readonly revision: number | null
  readonly status: "running" | "waiting" | "completed" | "failed" | "cancelled"
  readonly ready_actions: ReadonlyArray<Action>
  readonly artifacts: ReadonlyArray<Record<string, unknown>>
  readonly error: Record<string, unknown> | null
}

export class Error extends Schema.TaggedErrorClass<Error>()("SkillProtocolError", {
  code: Schema.String,
  message: Schema.String,
}) {}

const commands = new Set<Command>(["start", "advance", "submit_result", "submit_answer", "cancel", "status"])
const actions = new Set<ExecutableManifest.ActionType>(["llm.generate", "image.generate", "user.ask"])
const statuses = new Set<Response["status"]>(["running", "waiting", "completed", "failed", "cancelled"])

export function encodeRequest(input: Request) {
  validateRequest(input)
  const encoded = JSON.stringify(input)
  if (Buffer.byteLength(encoded, "utf8") > MAX_REQUEST_BYTES) {
    throw new Error({ code: "protocol-request-too-large", message: "Protocol request exceeds the size limit" })
  }
  return encoded
}

export function decodeResponse(input: string): Response {
  if (Buffer.byteLength(input, "utf8") > MAX_RESPONSE_BYTES) {
    throw new Error({ code: "protocol-response-too-large", message: "Protocol response exceeds the size limit" })
  }
  const value = parse(input)
  exact(value, [
    "protocol_version",
    "request_id",
    "workflow_id",
    "revision",
    "status",
    "ready_actions",
    "artifacts",
    "error",
  ], "response")
  if (typeof value.protocol_version !== "string" || !/^1\.\d+$/.test(value.protocol_version)) {
    throw new Error({ code: "protocol-version-unsupported", message: "Protocol response major is not supported" })
  }
  nullableString(value.request_id, "request_id")
  nullableString(value.workflow_id, "workflow_id")
  if (
    value.revision !== null &&
    (!Number.isInteger(value.revision) || typeof value.revision !== "number" || value.revision < 0)
  ) {
    throw new Error({ code: "protocol-response-invalid", message: "Response revision must be non-negative or null" })
  }
  if (typeof value.status !== "string" || !statuses.has(value.status as Response["status"])) {
    throw new Error({ code: "protocol-response-invalid", message: "Response status is not supported" })
  }
  if (!Array.isArray(value.ready_actions)) {
    throw new Error({ code: "protocol-response-invalid", message: "ready_actions must be an array" })
  }
  const ready = value.ready_actions.map(decodeAction)
  if (new Set(ready.map((action) => action.operation_id)).size !== ready.length) {
    throw new Error({ code: "protocol-response-invalid", message: "ready_actions must have unique operation IDs" })
  }
  if (!Array.isArray(value.artifacts) || value.artifacts.some((artifact) => !isRecord(artifact))) {
    throw new Error({ code: "protocol-response-invalid", message: "artifacts must contain objects" })
  }
  if (value.error !== null && !isRecord(value.error)) {
    throw new Error({ code: "protocol-response-invalid", message: "error must be an object or null" })
  }
  return {
    protocol_version: value.protocol_version,
    request_id: value.request_id as string | null,
    workflow_id: value.workflow_id as string | null,
    revision: value.revision as number | null,
    status: value.status as Response["status"],
    ready_actions: ready,
    artifacts: value.artifacts as Record<string, unknown>[],
    error: value.error as Record<string, unknown> | null,
  }
}

function validateRequest(input: Request) {
  if (input.protocol_version !== "1.0" || !input.request_id || !commands.has(input.command)) {
    throw new Error({ code: "protocol-request-invalid", message: "Protocol request identity is invalid" })
  }
  if (!path.isAbsolute(input.project_directory) && !path.win32.isAbsolute(input.project_directory)) {
    throw new Error({ code: "protocol-request-invalid", message: "Project directory must be absolute" })
  }
  if (input.workflow_id !== undefined && !input.workflow_id) {
    throw new Error({ code: "protocol-request-invalid", message: "workflow_id must not be empty" })
  }
  if (
    input.expected_revision !== undefined &&
    (!Number.isInteger(input.expected_revision) || input.expected_revision < 0)
  ) {
    throw new Error({ code: "protocol-request-invalid", message: "expected_revision must be non-negative" })
  }
  if (!isRecord(input.payload)) {
    throw new Error({ code: "protocol-request-invalid", message: "Protocol payload must be an object" })
  }
}

function parse(input: string) {
  try {
    const value: unknown = JSON.parse(input)
    if (isRecord(value)) return value
  } catch {
    // Mapped below to one stable public error.
  }
  throw new Error({ code: "protocol-response-invalid-json", message: "stdout must contain exactly one JSON object" })
}

function decodeAction(value: unknown): Action {
  if (!isRecord(value)) throw new Error({ code: "protocol-response-invalid", message: "Action must be an object" })
  exact(value, ["operation_id", "type", "depends_on", "requirements", "payload"], "action")
  if (typeof value.operation_id !== "string" || !value.operation_id) {
    throw new Error({ code: "protocol-response-invalid", message: "Action operation_id is invalid" })
  }
  if (typeof value.type !== "string" || !actions.has(value.type as ExecutableManifest.ActionType)) {
    throw new Error({ code: "protocol-action-unsupported", message: "Action type is not supported" })
  }
  if (
    !Array.isArray(value.depends_on) ||
    value.depends_on.some((dependency) => typeof dependency !== "string" || !dependency) ||
    new Set(value.depends_on).size !== value.depends_on.length
  ) {
    throw new Error({ code: "protocol-response-invalid", message: "Action dependencies are invalid" })
  }
  if (!isRecord(value.requirements) || !isRecord(value.payload)) {
    throw new Error({ code: "protocol-response-invalid", message: "Action requirements and payload must be objects" })
  }
  return {
    operation_id: value.operation_id,
    type: value.type as ExecutableManifest.ActionType,
    depends_on: value.depends_on as string[],
    requirements: value.requirements,
    payload: value.payload,
  }
}

function exact(value: Record<string, unknown>, allowed: ReadonlyArray<string>, label: string) {
  if (Object.keys(value).some((key) => !allowed.includes(key))) {
    throw new Error({ code: "protocol-response-unknown-field", message: `Protocol ${label} contains unknown fields` })
  }
}

function nullableString(value: unknown, label: string) {
  if (value !== null && (typeof value !== "string" || !value)) {
    throw new Error({ code: "protocol-response-invalid", message: `Response ${label} must be a string or null` })
  }
}

export * as SkillProtocol from "./protocol"
