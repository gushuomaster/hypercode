import { Schema } from "effect"

export const APPROVAL_PHRASE = "批准分镜，开始生成首帧图片。"

export type Checkpoint = {
  phase: "analysis" | "approval" | "generation" | "qc" | "delivery"
  segment_ids: ReadonlyArray<string>
  pending_action: string | null
}

export type HypercodeState = {
  schema_version: 1
  workflow_id: string
  chapter: number
  orchestration_pool: ReadonlyArray<string>
  image_pool: ReadonlyArray<string>
  approved_models: ReadonlyArray<string>
  checkpoint: Checkpoint
  approvals: ReadonlyArray<{ segment_id: string; decision: string; at: string }>
  provider_attempts: ReadonlyArray<{ provider: string; model: string; status: string; at: string }>
}

export const CheckpointSchema = Schema.Struct({
  phase: Schema.Literals(["analysis", "approval", "generation", "qc", "delivery"]),
  segment_ids: Schema.Array(Schema.String),
  pending_action: Schema.NullOr(Schema.String),
})

export const HypercodeStateSchema = Schema.Struct({
  schema_version: Schema.Literal(1),
  workflow_id: Schema.String,
  chapter: Schema.Number,
  orchestration_pool: Schema.Array(Schema.String),
  image_pool: Schema.Array(Schema.String),
  approved_models: Schema.Array(Schema.String),
  checkpoint: CheckpointSchema,
  approvals: Schema.Array(
    Schema.Struct({
      segment_id: Schema.String,
      decision: Schema.String,
      at: Schema.String,
    }),
  ),
  provider_attempts: Schema.Array(
    Schema.Struct({
      provider: Schema.String,
      model: Schema.String,
      status: Schema.String,
      at: Schema.String,
    }),
  ),
})

export type Segment = {
  segment_id: string
  chapter?: number
  source_start_seconds?: number
  source_end_seconds?: number
  [key: string]: unknown
}

export type Chapter = {
  chapter: number
  startSeconds: number
  endSeconds: number
  durationSeconds: number
}

export type WorkflowInput = {
  referenceVideo: string
  productImages: ReadonlyArray<string>
  outputDirectory: string
  productName?: string
  sessionID?: string
  market?: string
  skillLocation?: string
}

export type StoryboardQuestion = {
  questions: ReadonlyArray<{
    question: string
    header: string
    options: ReadonlyArray<{ label: string; description: string }>
    custom?: boolean
    multiple?: boolean
    presentation?: {
      images?: ReadonlyArray<{ url: string; alt: string }>
      facts?: ReadonlyArray<{ label: string; value: string }>
      tone?: "normal" | "warning" | "payment"
    }
  }>
}

export type ImageDecision = "accepted" | "rejected" | "force-accepted" | (string & {})

export type ExternalProjectState = {
  hypercode?: HypercodeState
  [key: string]: unknown
}

export function isHypercodeState(value: unknown): value is HypercodeState {
  if (typeof value !== "object" || value === null) return false
  try {
    Schema.decodeUnknownSync(HypercodeStateSchema)(value)
    return true
  } catch {
    return false
  }
}

export function decodeHypercodeState(value: unknown): HypercodeState {
  if (!isHypercodeState(value)) throw new Error("project-state.json has an invalid hypercode checkpoint")
  return {
    schema_version: 1,
    workflow_id: value.workflow_id,
    chapter: value.chapter,
    orchestration_pool: [...value.orchestration_pool],
    image_pool: [...value.image_pool],
    approved_models: [...value.approved_models],
    checkpoint: {
      phase: value.checkpoint.phase,
      segment_ids: [...value.checkpoint.segment_ids],
      pending_action: value.checkpoint.pending_action,
    },
    approvals: value.approvals.map((item) => ({ ...item })),
    provider_attempts: value.provider_attempts.map((item) => ({ ...item })),
  }
}

export * as VideoReplicaSchema from "./schema"
