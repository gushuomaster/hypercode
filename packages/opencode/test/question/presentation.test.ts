import { describe, expect, it } from "bun:test"
import { Schema } from "effect"
import { Question } from "../../src/question"

describe("question presentation schema", () => {
  it("accepts presentation fields without breaking legacy questions", () => {
    const question = Schema.decodeUnknownSync(Question.Info)({
      question: "ok",
      header: "h",
      options: [],
      presentation: {
        tone: "warning",
        facts: [{ label: "segment", value: "seg-1" }],
      },
    })

    expect(question).toMatchObject({ presentation: { tone: "warning" } })
  })

  it("preserves legacy questions without presentation", () => {
    const question = Schema.decodeUnknownSync(Question.Info)({ question: "ok", header: "h", options: [] })

    expect(question.presentation).toBeUndefined()
  })

  it("preserves presentation when decoding a pending request", () => {
    const request = Schema.decodeUnknownSync(Question.Request)({
      id: "que_test",
      sessionID: "ses_test",
      questions: [
        {
          question: "ok",
          header: "h",
          options: [],
          presentation: {
            images: [{ url: "file:///segment.png", alt: "Segment preview" }],
            facts: [{ label: "cost", value: "$0.10" }],
            tone: "payment",
          },
        },
      ],
    })

    expect(request.questions[0]?.presentation).toEqual({
      images: [{ url: "file:///segment.png", alt: "Segment preview" }],
      facts: [{ label: "cost", value: "$0.10" }],
      tone: "payment",
    })
  })
})
