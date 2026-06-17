export const DEFAULT_NEW_SESSION_TITLE = "New session"

export function isDefaultNewSessionTitle(title: string) {
  const clean = title.trim()
  return clean === DEFAULT_NEW_SESSION_TITLE || clean.startsWith(`${DEFAULT_NEW_SESSION_TITLE} - `)
}

export function displaySessionTitle(title: string | undefined, fallback: string) {
  const clean = title?.trim()
  if (!clean) {
    return fallback
  }

  return isDefaultNewSessionTitle(clean) ? DEFAULT_NEW_SESSION_TITLE : clean
}
