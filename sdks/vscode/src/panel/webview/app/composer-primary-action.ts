import type { ComposerRunningState } from "./composer-running-state"
import { t } from "../../../i18n"

type ComposerPrimaryActionInput = {
  draft: string
  imageCount: number
  blocked: boolean
  running: boolean
  escPending: boolean
  runningState?: ComposerRunningState
}

type ComposerPrimaryActionState = {
  kind: "submit" | "interrupt"
  disabled: boolean
  icon: "send" | "stop" | "stop-confirm"
  title: string
  ariaLabel: string
}

export function composerPrimaryAction(input: ComposerPrimaryActionInput): ComposerPrimaryActionState {
  if (input.runningState) {
    return {
      kind: "interrupt",
      disabled: false,
      icon: input.runningState.icon,
      title: input.runningState.title,
      ariaLabel: input.runningState.ariaLabel,
    }
  }

  if (input.running) {
    return {
      kind: "interrupt",
      disabled: false,
      icon: input.escPending ? "stop-confirm" : "stop",
      title: input.escPending ? t("composer.interruptAgain") : t("composer.interrupt"),
      ariaLabel: input.escPending ? t("composer.interruptNow") : t("composer.interrupt"),
    }
  }

  if (input.blocked) {
    return {
      kind: "submit",
      disabled: true,
      icon: "send",
      title: t("composer.submitUnavailable"),
      ariaLabel: t("composer.submitPrompt"),
    }
  }

  const hasContent = !!input.draft.trim() || input.imageCount > 0
  return {
    kind: "submit",
    disabled: !hasContent,
    icon: "send",
    title: t("composer.sendEnter"),
    ariaLabel: t("composer.submitPrompt"),
  }
}
