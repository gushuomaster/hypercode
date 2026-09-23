import { isRecord } from "./record"
import { t, type Locale } from "../i18n"

type ConfigIssue = { message: string; path: string[] }

export function cliErrorMessage(input: unknown): string | undefined {
  if (input instanceof Error && isRecord(input.cause) && "body" in input.cause) {
    const formatted = cliErrorMessage(input.cause.body)
    if (formatted) return formatted
  }

  if (tagged(input, "CliError")) {
    if (typeof input.exitCode === "number") process.exitCode = input.exitCode
    return field(input, "message") ?? ""
  }
  if (tagged(input, "AccountServiceError") || tagged(input, "AccountTransportError")) {
    return field(input, "message") ?? ""
  }

  const model = configData(input, "ProviderModelNotFoundError")
  if (model) {
    const suggestions = Array.isArray(model.suggestions)
      ? model.suggestions.filter((item): item is string => typeof item === "string")
      : []
    return [
      `Model not found: ${field(model, "providerID")}/${field(model, "modelID")}`,
      ...(suggestions.length ? ["Did you mean: " + suggestions.join(", ")] : []),
      "Try: `hypercode models` to list available models",
      "Or check your config (opencode.json) provider/model names",
    ].join("\n")
  }

  const provider = configData(input, "ProviderInitError")
  if (provider)
    return `Failed to initialize provider "${field(provider, "providerID")}". Check credentials and configuration.`

  const json = configData(input, "ConfigJsonError")
  if (json) {
    const message = field(json, "message")
    return `Config file at ${field(json, "path")} is not valid JSON(C)` + (message ? `: ${message}` : "")
  }

  const directory = configData(input, "ConfigDirectoryTypoError")
  if (directory) {
    return `Directory "${field(directory, "dir")}" in ${field(directory, "path")} is not valid. Rename the directory to "${field(directory, "suggestion")}" or remove it. This is a common typo.`
  }

  const frontmatter = configData(input, "ConfigFrontmatterError")
  if (frontmatter) return field(frontmatter, "message") ?? ""

  const invalid = configData(input, "ConfigInvalidError")
  if (invalid) {
    const path = field(invalid, "path")
    const message = field(invalid, "message")
    const issues = Array.isArray(invalid.issues)
      ? invalid.issues.filter((issue): issue is ConfigIssue => {
          return (
            isRecord(issue) &&
            typeof issue.message === "string" &&
            Array.isArray(issue.path) &&
            issue.path.every((item) => typeof item === "string")
          )
        })
      : []
    return [
      `Configuration is invalid${path && path !== "config" ? ` at ${path}` : ""}` + (message ? `: ${message}` : ""),
      ...issues.map((issue) => "↳ " + issue.message + " " + issue.path.join(".")),
    ].join("\n")
  }

  if (tagged(input, "UICancelledError") || named(input, "UICancelledError")) return ""
  if (isRecord(input) && named(input, "MCPFailed")) {
    const name = isRecord(input.data) ? field(input.data, "name") : undefined
    return `MCP server "${name}" failed. Note, opencode does not support MCP authentication yet.`
  }
  return undefined
}

function tagged(input: unknown, tag: string): input is Record<string, unknown> {
  return isRecord(input) && input._tag === tag
}

function named(input: unknown, name: string) {
  return isRecord(input) && (input.name === name || input._tag === name)
}

function configData(input: unknown, tag: string) {
  if (!isRecord(input)) return undefined
  if (input.name === tag && isRecord(input.data)) return input.data
  if (input._tag === tag) return input
  return undefined
}

function field(input: Record<string, unknown>, key: string) {
  return typeof input[key] === "string" ? input[key] : undefined
}

export function errorFormat(error: unknown): string {
  if (error instanceof Error) {
    return error.stack ?? `${error.name}: ${error.message}`
  }

  if (typeof error === "object" && error !== null) {
    try {
      const json = JSON.stringify(error, null, 2)
      // Plain objects whose own properties are all non-enumerable (or empty)
      // serialize to "{}", which prints as a useless bare `{}` on stderr.
      // Fall back to a custom toString first, then to ctor name + own prop names.
      if (json === "{}") {
        const str = String(error)
        if (str && str !== "[object Object]") return str
        const ctor = error.constructor?.name
        const prefix = ctor && ctor !== "Object" ? ctor : "Error"
        const names = Object.getOwnPropertyNames(error)
        return names.length === 0 ? `${prefix} (no message)` : `${prefix} { ${names.join(", ")} }`
      }
      return json
    } catch {
      return "Unexpected error (unserializable)"
    }
  }

  return String(error)
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    if (error.message) return error.message
    if (error.name) return error.name
  }

  if (isRecord(error) && typeof error.message === "string" && error.message) {
    return error.message
  }

  if (isRecord(error) && isRecord(error.data) && typeof error.data.message === "string" && error.data.message) {
    return error.data.message
  }

  const text = String(error)
  if (text && text !== "[object Object]") return text

  const formatted = errorFormat(error)
  if (formatted) return formatted
  return "unknown error"
}

export function sessionErrorMessage(error: unknown, locale?: Locale): string {
  if (!isRecord(error) || error.name !== "APIError" || !isRecord(error.data)) {
    const raw = errorMessage(error)
    const code = isRecord(error) && typeof error.name === "string" ? error.name : undefined
    return formatTuiProductError({ message: raw, raw, textKey: deriveProductErrorTextKey(code, raw) }, locale)
  }
  if (
    typeof error.data.responseBody !== "string" ||
    !error.data.responseBody.includes("FreeUsageLimitError")
  ) {
    const raw = errorMessage(error)
    return formatTuiProductError({
      code: error.name,
      message: raw,
      raw,
      textKey: deriveProductErrorTextKey(error.name, raw),
    }, locale)
  }

  const reset = retryAfter(error.data.responseHeaders)
  if (reset === undefined) return t("session.error.freeUsageLimit", undefined, locale)
  return t("session.error.freeUsageLimitReset", { duration: resetDuration(reset, locale) }, locale)
}

function retryAfter(value: unknown) {
  if (!isRecord(value)) return undefined

  const milliseconds = Number.parseFloat(typeof value["retry-after-ms"] === "string" ? value["retry-after-ms"] : "")
  if (!Number.isNaN(milliseconds)) return Math.max(0, Math.ceil(milliseconds / 1000))

  const retry = typeof value["retry-after"] === "string" ? value["retry-after"] : ""
  const seconds = Number.parseFloat(retry)
  if (!Number.isNaN(seconds)) return Math.max(0, Math.ceil(seconds))

  const timestamp = Date.parse(retry)
  if (Number.isNaN(timestamp)) return undefined
  return Math.max(0, Math.ceil((timestamp - Date.now()) / 1000))
}

function resetDuration(seconds: number, locale?: Locale) {
  const days = Math.floor(seconds / 86_400)
  const hours = Math.floor((seconds % 86_400) / 3_600)
  const minutes = Math.ceil((seconds % 3_600) / 60)
  const unit = (value: number, singular: "day" | "hour" | "minute") =>
    t(`session.error.duration.${singular}${value === 1 ? "" : "s"}`, { count: value }, locale)

  if (days > 0) return hours > 0 ? `${unit(days, "day")} ${unit(hours, "hour")}` : unit(days, "day")
  if (hours > 0) return minutes > 0 ? `${unit(hours, "hour")} ${unit(minutes, "minute")}` : unit(hours, "hour")
  return minutes > 0 ? unit(minutes, "minute") : t("session.error.duration.lessThanMinute", undefined, locale)
}

export function errorData(error: unknown) {
  if (error instanceof Error) {
    return {
      type: error.name,
      message: errorMessage(error),
      stack: error.stack,
      cause: error.cause === undefined ? undefined : errorFormat(error.cause),
      formatted: errorFormat(error),
    }
  }

  if (!isRecord(error)) {
    return {
      type: typeof error,
      message: errorMessage(error),
      formatted: errorFormat(error),
    }
  }

  const data = Object.getOwnPropertyNames(error).reduce<Record<string, unknown>>((acc, key) => {
    const value = error[key]
    if (value === undefined) return acc
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      acc[key] = value
      return acc
    }
    // oxlint-disable-next-line no-base-to-string -- intentional coercion of arbitrary error properties
    acc[key] = value instanceof Error ? value.message : String(value)
    return acc
  }, {})

  if (typeof data.message !== "string") data.message = errorMessage(error)
  if (typeof data.type !== "string") data.type = error.constructor?.name
  data.formatted = errorFormat(error)
  return data
}
import { deriveProductErrorTextKey } from "@opencode-ai/product"
import { formatTuiProductError } from "../product/text-adapter"
