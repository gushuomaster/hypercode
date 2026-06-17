import React from "react"

type CommandPillProps = {
  label: string
  preview?: string
  expanded?: boolean
  onClick?: () => void
}

export function CommandPill({ label, preview, expanded = false, onClick }: CommandPillProps) {
  const content = (
    <>
      <span className="oc-pillFileType">命令</span>
      <span className="oc-pillFilePath">{label}</span>
    </>
  )

  if (onClick) {
    return (
      <button
        type="button"
        className="oc-pill oc-pill-file oc-pill-command oc-pillButton"
        aria-label={`切换命令提示 ${label}`}
        aria-expanded={expanded}
        data-preview={preview || undefined}
        onClick={onClick}
      >
        {content}
      </button>
    )
  }

  return (
    <span className="oc-pill oc-pill-file oc-pill-command" data-preview={preview || undefined}>
      {content}
    </span>
  )
}
