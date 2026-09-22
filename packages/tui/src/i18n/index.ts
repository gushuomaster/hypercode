import * as i18n from "@solid-primitives/i18n"
import { dict as en, type Keys } from "./en"
import { dict as zh } from "./zh"

export type Locale = "en" | "zh"

export const LOCALES: readonly Locale[] = ["zh", "en"]

type Environment = Partial<Record<"LANG" | "LC_ALL" | "LANGUAGE", string | undefined>>

const dicts: Record<Locale, typeof en> = {
  en,
  zh,
}

let locale = normalizeLocale(undefined)

export function normalizeLocale(
  value: unknown,
  environment: Environment = {
    LANG: process.env.LANG,
    LC_ALL: process.env.LC_ALL,
    LANGUAGE: process.env.LANGUAGE,
  },
): Locale {
  if (value === "en" || value === "zh") return value
  const detected = environment.LANG || environment.LC_ALL || environment.LANGUAGE || ""
  return detected.toLowerCase().startsWith("zh") ? "zh" : "en"
}

export function getLocale() {
  return locale
}

export function setLocale(value: Locale) {
  locale = value
}

const translators = {
  en: i18n.translator(() => dicts.en, i18n.resolveTemplate),
  zh: i18n.translator(() => dicts.zh, i18n.resolveTemplate),
}

export function t(key: Keys, params?: Record<string, string | number | boolean>, value = locale) {
  return translators[value](key, params)
}

const agentNames = {
  build: "agent.display.build",
  plan: "agent.display.plan",
  general: "agent.display.general",
  explore: "agent.display.explore",
} as const satisfies Record<string, Keys>

export function agentDisplayName(name: string, value = locale) {
  const key = agentNames[name as keyof typeof agentNames]
  return key ? t(key, undefined, value) : name
}

type CommandDescription = {
  description?: string
  description_i18n?: {
    zh?: string
    en?: string
  }
  source?: "command" | "mcp" | "skill"
}

export function localizedDescription(command: CommandDescription, value = locale) {
  return command.description_i18n?.[value] || command.description
}

export function commandSourceLabel(command: CommandDescription, value = locale) {
  if (command.source === "mcp") return t("command.source.mcp", undefined, value)
  if (command.source === "skill") return t("command.source.skill", undefined, value)
  if (command.description_i18n) return t("command.source.command", undefined, value)
  return t("command.source.custom", undefined, value)
}
