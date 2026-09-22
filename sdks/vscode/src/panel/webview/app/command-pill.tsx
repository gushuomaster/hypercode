import React from "react"
import { t } from "../../../i18n"

type CommandPillProps = {
  label: string
  preview?: string
  expanded?: boolean
  onClick?: () => void
}

export function CommandPill({ label, preview, expanded = false, onClick }: CommandPillProps) {
  const content = (
    <>
      <span className="oc-pillFileType">{t("commandPill.kind")}</span>
      <span className="oc-pillFilePath">{label}</span>
    </>
  )

  if (onClick) {
    return (
      <button
        type="button"
        className="oc-pill oc-pill-file oc-pill-command oc-pillButton"
        aria-label={t("commandPill.toggle", { label })}
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
