import path from "path"
import { parse, type ParseError } from "jsonc-parser"
import { Global } from "@opencode-ai/core/global"
import { normalizeLocale, setLocale, type Locale } from "@opencode-ai/tui/i18n"
import { isRecord } from "@opencode-ai/tui/util/record"

type Environment = Partial<Record<string, string | undefined>>

export async function resolveCliLocale(input: {
  configFiles: string[]
  stateFile: string
  environment: Environment
}) {
  const configured = (
    await Promise.all(input.configFiles.map((file) => readLanguage(file)))
  ).findLast((value): value is Locale => value !== undefined)
  if (configured) return configured

  const saved = await readLanguage(input.stateFile)
  if (saved) return saved
  return normalizeLocale(undefined, input.environment)
}

export async function initializeCliLocale(directory: string) {
  const locale = await resolveCliLocale({
    configFiles: discoverLocaleFiles(directory),
    stateFile: path.join(Global.Path.state, "kv.json"),
    environment: process.env,
  })
  setLocale(locale)
  return locale
}

function discoverLocaleFiles(directory: string) {
  const parents = ancestors(path.resolve(directory))
  const project = process.env.OPENCODE_DISABLE_PROJECT_CONFIG
    ? []
    : parents.flatMap((dir) => [
        path.join(dir, "tui.json"),
        path.join(dir, "tui.jsonc"),
        path.join(dir, ".hypercode", "tui.json"),
        path.join(dir, ".hypercode", "tui.jsonc"),
        path.join(dir, ".opencode", "tui.json"),
        path.join(dir, ".opencode", "tui.jsonc"),
      ])
  const explicit = process.env.OPENCODE_TUI_CONFIG ? [process.env.OPENCODE_TUI_CONFIG] : []
  const configDir = process.env.OPENCODE_CONFIG_DIR
    ? [
        path.join(process.env.OPENCODE_CONFIG_DIR, "tui.json"),
        path.join(process.env.OPENCODE_CONFIG_DIR, "tui.jsonc"),
      ]
    : []
  return [
    path.join(Global.Path.config, "tui.json"),
    path.join(Global.Path.config, "tui.jsonc"),
    ...explicit,
    ...project,
    ...configDir,
  ]
}

function ancestors(directory: string): string[] {
  const parent = path.dirname(directory)
  if (parent === directory) return [directory]
  return [...ancestors(parent), directory]
}

async function readLanguage(file: string): Promise<Locale | undefined> {
  const text = await Bun.file(file)
    .text()
    .catch(() => undefined)
  if (!text) return

  const errors: ParseError[] = []
  const parsed = parse(text, errors, { allowTrailingComma: true })
  if (errors.length > 0 || !isRecord(parsed)) return
  const value = isRecord(parsed.tui) && parsed.language === undefined ? parsed.tui.language : parsed.language
  if (value !== "en" && value !== "zh") return
  return value
}
