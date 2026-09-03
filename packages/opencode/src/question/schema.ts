import { Schema } from "effect"

import { Identifier } from "@/id/id"
import { Newtype } from "@opencode-ai/core/schema"

export const PresentationImage = Schema.Struct({
  url: Schema.String,
  alt: Schema.String,
}).annotate({ identifier: "QuestionPresentationImage" })
export type PresentationImage = Schema.Schema.Type<typeof PresentationImage>

export const PresentationFact = Schema.Struct({
  label: Schema.String,
  value: Schema.String,
}).annotate({ identifier: "QuestionPresentationFact" })
export type PresentationFact = Schema.Schema.Type<typeof PresentationFact>

export const PresentationTone = Schema.Union([
  Schema.Literal("normal"),
  Schema.Literal("warning"),
  Schema.Literal("payment"),
]).annotate({ identifier: "QuestionPresentationTone" })
export type PresentationTone = Schema.Schema.Type<typeof PresentationTone>

export const Presentation = Schema.Struct({
  images: Schema.optional(Schema.Array(PresentationImage)),
  facts: Schema.optional(Schema.Array(PresentationFact)),
  tone: Schema.optional(PresentationTone),
}).annotate({ identifier: "QuestionPresentation" })
export type Presentation = Schema.Schema.Type<typeof Presentation>

export class QuestionID extends Newtype<QuestionID>()("QuestionID", Schema.String.check(Schema.isStartsWith("que"))) {
  static ascending(id?: string): QuestionID {
    return this.make(Identifier.ascending("question", id))
  }
}
