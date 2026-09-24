import { EN } from "./en"
import { ZH } from "./zh"
import { toVsCodeProductLocale } from "../product/locale-adapter"

export { EN, ZH }

export type Locale = "en" | "zh"
export type TranslationKey = keyof typeof EN

let locale: Locale = "en"

export function normalizeLocale(value?: string): Locale {
  return toVsCodeProductLocale(value).locale
}

export function setLocale(value?: string) {
  locale = normalizeLocale(value)
  return locale
}

export function getLocale() {
  return locale
}

export function t(key: TranslationKey, params?: Record<string, string | number>, language = locale) {
  const value = language === "zh" ? ZH[key] : EN[key]
  if (!params) return value
  return value.replace(/\{([^{}]+)\}/g, (match, name: string) => params[name]?.toString() ?? match)
}

export function localizedCommandDescription(
  command: {
    description?: string
    description_i18n?: {
      zh?: string
      en?: string
    }
  },
  language = locale,
) {
  return command.description_i18n?.[language] ?? command.description
}
