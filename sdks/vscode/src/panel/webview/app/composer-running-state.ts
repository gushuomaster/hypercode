import type { SessionStatus } from "../../../core/sdk"

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

  const label = status.type === "retry" ? "重试中" : "思考中"
  if (escPending) {
    return {
      label,
      hint: "再按 Esc 键中断",
      tone: "armed",
      icon: "stop-confirm",
      title: "再次按下以中断",
      ariaLabel: "立即中断当前会话",
    }
  }

  return {
    label,
    hint: "按 Esc 键中断",
    tone: status.type === "retry" ? "retry" : "running",
    icon: "stop",
    title: "中断当前会话",
    ariaLabel: "中断当前会话",
  }
}
