import { describe, expect, test } from "bun:test"
import type { QuestionInfo } from "@opencode-ai/sdk/v2"
import { hasPresentation, toPresentationView } from "./question-presentation"

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

  test("renders a tone-only presentation", () => {
    const question = {
      question: "Review this segment?",
      header: "Review",
      options: [],
      presentation: { tone: "warning" as const },
    } as QuestionInfo & { presentation: { tone: "warning" } }

    expect(hasPresentation(question)).toBe(true)
    expect(toPresentationView(question)).toMatchObject({ tone: "warning", facts: [], images: [] })
  })

  test("keeps thumbnail alt text for accessible buttons", () => {
    const question = {
      question: "Review this segment?",
      header: "Review",
      options: [],
      presentation: { images: [{ url: "file:///segment.png", alt: "Segment preview" }] },
    } as QuestionInfo & {
      presentation: { images: ReadonlyArray<{ url: string; alt: string }> }
    }

    expect(toPresentationView(question).images[0]).toEqual({
      url: "file:///segment.png",
      alt: "Segment preview",
    })
  })
})
