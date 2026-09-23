import { deriveProductSessionSwitch, type ProductAction, type ProductProviderAction, type ProductSelectionAction, type ProductSessionMutationAction } from "@opencode-ai/product"
import type { WebviewMessage } from "../../../bridge/types"

export type VsCodeProductActionTarget =
  | { kind: "host"; message: WebviewMessage }
  | { kind: "selection"; action: ProductSelectionAction }
  | { kind: "mutation"; action: ProductSessionMutationAction }
  | { kind: "provider"; action: ProductProviderAction }
  | { kind: "none" }
  | { kind: "unavailable"; action: "session.retry" }

type SubmitMessage = Extract<WebviewMessage, { type: "submit" }>

export type VsCodeProductActionOptions = Pick<SubmitMessage, "parts" | "images"> & {
  currentSessionID?: string
  sessions?: Array<{ id: string; available: boolean }>
}

export function toVsCodeProductAction(action: ProductAction, options: VsCodeProductActionOptions = {}): VsCodeProductActionTarget {
  if (action.type === "composer.submit") {
    return {
      kind: "host",
      message: {
        type: "submit",
        text: action.text,
        ...(options.parts ? { parts: options.parts } : {}),
        ...(options.images ? { images: options.images } : {}),
        ...(action.agent ? { agent: action.agent } : {}),
        ...(action.model ? { model: action.model } : {}),
        ...(action.variant ? { variant: action.variant } : {}),
      },
    }
  }
  if (action.type === "session.interrupt") return composerAction("interruptSession")
  if (action.type === "session.retry") return { kind: "unavailable", action: action.type }
  if (action.type === "session.compact") return composerAction("compactSession", action.model)
  if (action.type === "session.undo") return composerAction("undoSession")
  if (action.type === "session.redo") return composerAction("redoSession")
  if (action.type === "session.select" || action.type === "session.switch") {
    const target = deriveProductSessionSwitch({
      sessions: options.sessions ?? [],
      currentSessionID: options.currentSessionID,
      targetSessionID: action.sessionID,
    })
    return target ? { kind: "host", message: { type: "switchSessionInPlace", sessionID: target.sessionID } } : { kind: "none" }
  }
  if (action.type === "session.rename" || action.type === "session.archive" || action.type === "session.share" || action.type === "session.unshare" || action.type === "session.tag.add" || action.type === "session.tag.remove") {
    return { kind: "mutation", action }
  }
  if (action.type === "provider.connect" || action.type === "provider.authenticate" || action.type === "provider.openDocs" || action.type === "provider.retry") {
    return { kind: "provider", action }
  }
  if (action.type === "model.select" || action.type === "agent.select" || action.type === "variant.select") {
    return { kind: "selection", action }
  }
  if (action.type === "permission.reply") {
    return {
      kind: "host",
      message: {
        type: "permissionReply",
        requestID: action.requestID,
        reply: action.reply,
        ...(action.message ? { message: action.message } : {}),
      },
    }
  }
  if (action.type === "question.reply") {
    return { kind: "host", message: { type: "questionReply", requestID: action.requestID, answers: action.answers } }
  }
  return { kind: "host", message: { type: "questionReject", requestID: action.requestID } }
}

export function toVsCodeProductSelection(action: ProductSelectionAction): ProductSelectionAction | undefined {
  const target = toVsCodeProductAction(action)
  if (target.kind !== "selection") return
  return target.action
}

function composerAction(action: Extract<WebviewMessage, { type: "composerAction" }>["action"], model?: Extract<ProductAction, { type: "session.compact" }>["model"]): VsCodeProductActionTarget {
  return {
    kind: "host",
    message: {
      type: "composerAction",
      action,
      ...(model ? { model } : {}),
    },
  }
}
