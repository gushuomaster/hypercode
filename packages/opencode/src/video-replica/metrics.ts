export const REQUIRED_METRICS = [
  "video_analysis_seconds",
  "approval_preparation_seconds",
  "asset_matching_seconds",
  "qc_prompt_state_dispatch_seconds",
  "other_agent_compute_seconds",
  "image_service_wait_seconds",
  "approval_wait_seconds",
  "asset_user_wait_seconds",
  "asset_ingestion_seconds",
] as const

export type WorkflowMetricName = (typeof REQUIRED_METRICS)[number]
export type WorkflowMetrics = Record<WorkflowMetricName, number> & {
  controllable_seconds: number
  total_active_seconds: number
  total_wall_seconds: number
}

export function calculateWorkflowMetrics(input: Partial<Record<WorkflowMetricName, number>>): WorkflowMetrics {
  for (const name of REQUIRED_METRICS) {
    const value = input[name]
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0) throw new Error(`Invalid workflow metric: ${name}`)
  }
  const normalized = Object.fromEntries(REQUIRED_METRICS.map((name) => [name, input[name]!])) as Record<WorkflowMetricName, number>
  const controllable = normalized.video_analysis_seconds + normalized.approval_preparation_seconds + normalized.qc_prompt_state_dispatch_seconds + normalized.other_agent_compute_seconds
  const active = controllable + normalized.image_service_wait_seconds
  const wall = active + normalized.approval_wait_seconds + normalized.asset_user_wait_seconds
  return {
    ...normalized,
    controllable_seconds: round(controllable),
    total_active_seconds: round(active),
    total_wall_seconds: round(wall),
  }
}

function round(value: number) {
  return Math.round(value * 1_000_000) / 1_000_000
}

export * as VideoReplicaMetrics from "./metrics"
