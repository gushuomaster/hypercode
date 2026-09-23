import { isProductSessionRunning, type ProductRunState } from "@opencode-ai/product"
import { t } from "../../../i18n"

export type ComposerRunningState = {
  label: string
  hint: string
  tone: "running" | "retry" | "armed"
  icon: "stop" | "stop-confirm"
  title: string
  ariaLabel: string
}

export function composerRunningState(status: ProductRunState, escPending: boolean): ComposerRunningState | undefined {
  if (!isProductSessionRunning(status)) return undefined

  const label = status === "retry" ? t("composer.retrying") : t("composer.thinking")
  if (escPending) {
    return {
      label,
      hint: t("composer.escAgain"),
      tone: "armed",
      icon: "stop-confirm",
      title: t("composer.interruptAgain"),
      ariaLabel: t("composer.interruptNow"),
    }
  }

  return {
    label,
    hint: t("composer.escHint"),
    tone: status === "retry" ? "retry" : "running",
    icon: "stop",
    title: t("composer.interrupt"),
    ariaLabel: t("composer.interrupt"),
  }
}
