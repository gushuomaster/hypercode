import React from "react"

type SkillPillProps = {
  name: string
  onClick?: () => void
}

export function SkillPill({ name, onClick }: SkillPillProps) {
  const content = (
    <>
      <span className="oc-pillFileType">SKILL</span>
      <span className="oc-pillFilePath">{name}</span>
    </>
  )

  if (onClick) {
    return (
      <button type="button" className="oc-pill oc-pill-file oc-pill-skill oc-pillButton" aria-label={`Open skill ${name}`} onClick={onClick}>
        {content}
      </button>
    )
  }

  return (
    <span className="oc-pill oc-pill-file oc-pill-skill">
      {content}
    </span>
  )
}
