import { t } from "../../i18n"

export function friendlyShellSubmitError(message: string) {
  const normalized = message.replace(/\s+/g, " ").trim()
  if (/(^|\b)session\b.*\bis busy\b/i.test(normalized) || /\bis busy\b/i.test(normalized)) {
    return t("panel.shellSessionBusy")
  }

  if (/workspace server is not ready/i.test(normalized)) {
    return t("panel.workspaceNotReady")
  }

  const cleaned = normalized
    .replace(/^(UnknownError|NotFoundError|BadRequestError):\s*/i, "")
    .replace(/^Error:\s*/i, "")
    .replace(/\s*\((src|\.\.\/).+$/i, "")
    .trim()

  return t("panel.shellSendFailed", { message: cleaned || t("common.unknownError") })
}
