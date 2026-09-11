import type { Artifact } from "@/artifact/schema"

export type Provider = string

export type Request = {
  readonly workflowID: string
  readonly operationID: string
  readonly prompt: string
  readonly referenceImages: ReadonlyArray<string>
  readonly modelPool: ReadonlyArray<{ readonly provider: Provider; readonly model: string }>
  readonly width: number
  readonly height: number
}

export type Result = {
  readonly operationID: string
  readonly artifact: Artifact.Metadata
  readonly provider: Provider
  readonly model: string
  readonly attempts: number
  readonly elapsedMs: number
  readonly cost: Artifact.Cost
}

export * as ImageGeneration from "./schema"
