import { deriveProductErrorTextKey } from "@opencode-ai/product"
import { t } from "../../i18n"
import { toVsCodeTextKey } from "../webview/lib/product-text-adapter"

// A remote config behind SSO fails every instance request with ConfigRemoteAuthError (HTTP 400).
// Kept free of the vscode module so the mapping stays unit-testable.
export function remoteConfigAuthMessage(error: unknown) {
  const record = error && typeof error === "object" ? (error as { name?: unknown; data?: { url?: unknown } }) : undefined
  const textKey = deriveProductErrorTextKey(typeof record?.name === "string" ? record.name : undefined, "")
  if (textKey !== "error.config.remote_auth") return undefined
  const url = typeof record?.data?.url === "string" ? record.data.url : undefined
  return [t(toVsCodeTextKey(textKey)), "hypercode auth login" + (url ? " " + url : "")].join("\n")
}
