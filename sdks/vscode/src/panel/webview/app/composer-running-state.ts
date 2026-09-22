import type { SessionStatus } from "../../../core/sdk"
import { t } from "../../../i18n"

export type ComposerRunningState = {
  label: string
  hint: string
  tone: "running" | "retry" | "armed"
  icon: "stop" | "stop-confirm"
  title: string
  ariaLabel: string
}

export function composerRunningState(status: SessionStatus | undefined, escPending: boolean): ComposerRunningState | undefined {
  if (status?.type !== "busy" && status?.type !== "retry") {
    return undefined
  }

  const label = status.type === "retry" ? t("composer.retrying") : t("composer.thinking")
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
    tone: status.type === "retry" ? "retry" : "running",
    icon: "stop",
    title: t("composer.interrupt"),
    ariaLabel: t("composer.interrupt"),
  }
}
