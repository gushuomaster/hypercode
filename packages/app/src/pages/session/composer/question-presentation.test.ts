import { describe, expect, test } from "bun:test"
import type { QuestionInfo } from "@opencode-ai/sdk/v2"
import { toPresentationView } from "./question-presentation"

describe("question presentation view", () => {
  test("maps presentation facts and thumbnails to stable render data", () => {
    const question = {
      question: "Review this segment?",
      header: "Review",
      options: [],
      presentation: {
        tone: "payment" as const,
        facts: [{ label: "segment", value: "seg-1" }],
        images: [{ url: "file:///segment.png", alt: "Segment preview" }],
      },
    } as QuestionInfo & {
      presentation: {
        tone: "normal" | "warning" | "payment"
        facts: ReadonlyArray<{ label: string; value: string }>
        images: ReadonlyArray<{ url: string; alt: string }>
      }
    }

    expect(toPresentationView(question)).toEqual({
      tone: "payment",
      facts: [{ label: "segment", value: "seg-1" }],
      images: [{ url: "file:///segment.png", alt: "Segment preview" }],
    })
  })

  test("uses a neutral tone for legacy questions", () => {
    expect(toPresentationView({ question: "ok", header: "h", options: [] })).toEqual({
      tone: "normal",
      facts: [],
      images: [],
    })
  })
})
