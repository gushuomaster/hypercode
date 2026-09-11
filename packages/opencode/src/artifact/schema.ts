import { Schema } from "effect"

export const ID = Schema.String.pipe(Schema.brand("Artifact.ID"))
export type ID = typeof ID.Type

export type Owner = {
  readonly workflowID: string
  readonly operationID: string
}

export type Cost = {
  readonly amount?: number
  readonly currency?: string
  readonly known: boolean
}

export type Source = {
  readonly provider: string
  readonly model: string
  readonly attempts: number
  readonly cost: Cost
}

export type Metadata = {
  readonly artifactID: ID
  readonly readRef: string
  readonly mimeType: string
  readonly hash: string
  readonly size: number
  readonly createdAt: string
  readonly expiresAt: string
  readonly source?: Source
}

export class Error extends Schema.TaggedErrorClass<Error>()("ArtifactError", {
  code: Schema.String,
  message: Schema.String,
}) {}

export * as Artifact from "./schema"
