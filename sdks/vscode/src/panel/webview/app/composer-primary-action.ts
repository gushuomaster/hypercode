import type { ComposerRunningState } from "./composer-running-state"

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
      title: input.escPending ? "再次按下以中断" : "中断当前会话",
      ariaLabel: input.escPending ? "立即中断当前会话" : "中断当前会话",
    }
  }

  if (input.blocked) {
    return {
      kind: "submit",
      disabled: true,
      icon: "send",
      title: "提交不可用",
      ariaLabel: "提交提示词",
    }
  }

  const hasContent = !!input.draft.trim() || input.imageCount > 0
  return {
    kind: "submit",
    disabled: !hasContent,
    icon: "send",
    title: "回车键发送",
    ariaLabel: "提交提示词",
  }
}
