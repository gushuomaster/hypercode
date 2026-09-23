import { deriveProductSessionSwitch, type ProductAction, type ProductProviderAction, type ProductSelectionAction, type ProductSessionMutationAction } from "@opencode-ai/product"

type TuiActionContext = {
  sessionID: string
  directory?: string
  workspace?: string
  sessions?: Array<{ id: string; available: boolean }>
}

export type TuiProductActionTarget =
  | { kind: "session.prompt"; input: { sessionID: string; text: string; agent?: string; model?: { providerID: string; modelID: string }; variant?: string } }
  | { kind: "session.abort"; input: { sessionID: string } }
  | { kind: "session.summarize"; input: { sessionID: string; providerID?: string; modelID?: string } }
  | { kind: "session.revert"; input: { sessionID: string; messageID?: string } }
  | { kind: "session.unrevert"; input: { sessionID: string } }
  | { kind: "session.switch"; input: { sessionID: string } }
  | { kind: "permission.reply"; input: { requestID: string; reply: "once" | "always" | "reject"; message?: string; directory?: string; workspace?: string } }
  | { kind: "question.reply"; input: { requestID: string; answers: string[][]; directory?: string } }
  | { kind: "question.reject"; input: { requestID: string; directory?: string } }
  | { kind: "selection"; action: ProductSelectionAction }
  | { kind: "session.mutation"; action: ProductSessionMutationAction }
  | { kind: "provider"; action: ProductProviderAction }
  | { kind: "none" }
  | { kind: "unavailable"; action: "session.retry" }

export function toTuiProductAction(action: ProductAction, context: TuiActionContext): TuiProductActionTarget {
  if (action.type === "composer.submit") {
    return {
      kind: "session.prompt",
      input: {
        sessionID: context.sessionID,
        text: action.text,
        ...(action.agent ? { agent: action.agent } : {}),
        ...(action.model ? { model: action.model } : {}),
        ...(action.variant ? { variant: action.variant } : {}),
      },
    }
  }
  if (action.type === "session.interrupt") return { kind: "session.abort", input: { sessionID: context.sessionID } }
  if (action.type === "session.retry") return { kind: "unavailable", action: action.type }
  if (action.type === "session.compact") {
    return {
      kind: "session.summarize",
      input: {
        sessionID: context.sessionID,
        ...(action.model ? { providerID: action.model.providerID, modelID: action.model.modelID } : {}),
      },
    }
  }
  if (action.type === "session.undo") {
    return { kind: "session.revert", input: { sessionID: context.sessionID, ...(action.messageID ? { messageID: action.messageID } : {}) } }
  }
  if (action.type === "session.redo") return { kind: "session.unrevert", input: { sessionID: context.sessionID } }
  if (action.type === "session.select" || action.type === "session.switch") {
    const target = deriveProductSessionSwitch({
      sessions: context.sessions ?? [],
      currentSessionID: context.sessionID,
      targetSessionID: action.sessionID,
    })
    return target ? { kind: "session.switch", input: target } : { kind: "none" }
  }
  if (action.type === "model.select" || action.type === "agent.select" || action.type === "variant.select") {
    return { kind: "selection", action }
  }
  if (action.type === "session.rename"
    || action.type === "session.archive"
    || action.type === "session.share"
    || action.type === "session.unshare"
    || action.type === "session.tag.add"
    || action.type === "session.tag.remove") {
    return { kind: "session.mutation", action }
  }
  if (action.type === "provider.connect" || action.type === "provider.authenticate" || action.type === "provider.openDocs" || action.type === "provider.retry") {
    return { kind: "provider", action }
  }
  if (action.type === "permission.reply") {
    return {
      kind: "permission.reply",
      input: {
        requestID: action.requestID,
        reply: action.reply,
        ...(action.message ? { message: action.message } : {}),
        ...(context.directory ? { directory: context.directory } : {}),
        ...(context.workspace ? { workspace: context.workspace } : {}),
      },
    }
  }
  if (action.type === "question.reply") {
    return {
      kind: "question.reply",
      input: {
        requestID: action.requestID,
        answers: action.answers,
        ...(context.directory ? { directory: context.directory } : {}),
      },
    }
  }
  return {
    kind: "question.reject",
    input: {
      requestID: action.requestID,
      ...(context.directory ? { directory: context.directory } : {}),
    },
  }
}

export function toTuiProductSelection(action: ProductSelectionAction): ProductSelectionAction | undefined {
  const target = toTuiProductAction(action, { sessionID: "" })
  if (target.kind !== "selection") return
  return target.action
}
