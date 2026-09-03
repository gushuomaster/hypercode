import type { QuestionInfo } from "@opencode-ai/sdk/v2"

export type QuestionPresentationTone = "normal" | "warning" | "payment"

export interface QuestionPresentationView {
  tone: QuestionPresentationTone
  facts: ReadonlyArray<{ label: string; value: string }>
  images: ReadonlyArray<{ url: string; alt: string }>
}

type PresentationCarrier = {
  presentation?: {
    tone?: QuestionPresentationTone
    facts?: ReadonlyArray<{ label: string; value: string }>
    images?: ReadonlyArray<{ url: string; alt: string }>
  }
}

export function toPresentationView(question: QuestionInfo | undefined): QuestionPresentationView {
  if (!question) return { tone: "normal", facts: [], images: [] }

  const presentation = (question as QuestionInfo & PresentationCarrier).presentation
  return {
    tone: presentation?.tone ?? "normal",
    facts: presentation?.facts ?? [],
    images: presentation?.images ?? [],
  }
}
