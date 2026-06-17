export function friendlyShellSubmitError(message: string) {
  const normalized = message.replace(/\s+/g, " ").trim()
  if (/(^|\b)session\b.*\bis busy\b/i.test(normalized) || /\bis busy\b/i.test(normalized)) {
    return "Session is currently running. Wait for it to finish, then retry the shell command."
  }

  if (/workspace server is not ready/i.test(normalized)) {
    return "Workspace server is not ready."
  }

  const cleaned = normalized
    .replace(/^(UnknownError|NotFoundError|BadRequestError):\s*/i, "")
    .replace(/^Error:\s*/i, "")
    .replace(/\s*\((src|\.\.\/).+$/i, "")
    .trim()

  return `Failed to send shell command: ${cleaned || "Unknown error"}`
}
