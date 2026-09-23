import type { ProductModelRef } from "./types"

export type ProductAction =
  | { type: "composer.submit"; text: string; agent?: string; model?: ProductModelRef; variant?: string }
  | { type: "session.interrupt" }
  | { type: "session.retry" }
  | { type: "session.compact"; model?: ProductModelRef }
  | { type: "session.undo"; messageID?: string }
  | { type: "session.redo" }
  | { type: "session.select"; sessionID: string }
  | { type: "session.switch"; sessionID: string }
  | { type: "session.rename"; sessionID: string; title: string }
  | { type: "session.archive"; sessionID: string }
  | { type: "session.share"; sessionID: string }
  | { type: "session.unshare"; sessionID: string }
  | { type: "session.tag.add"; sessionID: string; tag: string }
  | { type: "session.tag.remove"; sessionID: string; tag: string }
  | { type: "model.select"; model: ProductModelRef }
  | { type: "agent.select"; agent: string }
  | { type: "variant.select"; model: ProductModelRef; variant?: string }
  | { type: "permission.reply"; requestID: string; reply: "once" | "always" | "reject"; message?: string }
  | { type: "question.reply"; requestID: string; answers: string[][] }
  | { type: "question.reject"; requestID: string }

export type ProductSelectionAction = Extract<ProductAction, { type: "model.select" | "agent.select" | "variant.select" }>

export type ProductSessionMutationAction = Extract<ProductAction, {
  type: "session.rename" | "session.archive" | "session.share" | "session.unshare" | "session.tag.add" | "session.tag.remove"
}>

export type ProductActionEffect = {
  clearComposer: boolean
  clearError: boolean
}

export function deriveProductActionEffect(action: ProductAction): ProductActionEffect {
  return {
    clearComposer: action.type === "composer.submit"
      || action.type === "session.compact"
      || action.type === "session.undo"
      || action.type === "session.redo"
      || action.type === "session.select"
      || action.type === "session.switch",
    clearError: true,
  }
}
