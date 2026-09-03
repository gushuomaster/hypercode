import { describe, expect, it } from "bun:test"
import { calculateWorkflowMetrics, REQUIRED_METRICS } from "@/video-replica/metrics"

describe("VideoReplica workflow metrics", () => {
  it("calculates controllable, active, and wall time without double counting", () => {
    const input = Object.fromEntries(REQUIRED_METRICS.map((name, index) => [name, index + 1]))
    expect(calculateWorkflowMetrics(input)).toMatchObject({
      controllable_seconds: 12,
      total_active_seconds: 18,
      total_wall_seconds: 33,
    })
  })

  it("rejects missing, negative, or non-finite values", () => {
    expect(() => calculateWorkflowMetrics({})).toThrow("video_analysis_seconds")
    const input = Object.fromEntries(REQUIRED_METRICS.map((name) => [name, 0]))
    expect(() => calculateWorkflowMetrics({ ...input, approval_wait_seconds: -1 })).toThrow("approval_wait_seconds")
    expect(() => calculateWorkflowMetrics({ ...input, asset_user_wait_seconds: Number.NaN })).toThrow("asset_user_wait_seconds")
  })
})
