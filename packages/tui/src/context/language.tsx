import * as i18n from "@solid-primitives/i18n"
import { createMemo, createSignal } from "solid-js"
import { createSimpleContext } from "./helper"
import { useKV } from "./kv"
import { useTuiConfig } from "../config"
import { dict as en } from "../i18n/en"
import { dict as zh } from "../i18n/zh"

export type Locale = "en" | "zh"

export const LOCALES: readonly Locale[] = ["zh", "en"]

type Dictionary = typeof en

const dicts: Record<Locale, Dictionary> = {
  en,
  zh: zh as Dictionary,
}

function detectLocale(): Locale {
  const env = process.env.LANG || process.env.LC_ALL || process.env.LANGUAGE || ""
  if (env.toLowerCase().startsWith("en")) return "en"
  return "zh"
}

export function normalizeLocale(value: unknown): Locale {
  return value === "en" || value === "zh" ? value : detectLocale()
}

// 模块级全局 locale,供非组件上下文(如内置插件注册命令时)使用。
// LanguageProvider 初始化和 setLocale 时同步更新它。
const [globalLocale, setGlobalLocale] = createSignal<Locale>(detectLocale())

// 独立的翻译函数,读取全局 locale,可在任意位置调用(包括插件初始化)。
// 在响应式作用域里通过 getter 调用即可随语言切换刷新。
export const translate = i18n.translator(
  () => dicts[globalLocale()],
  i18n.resolveTemplate,
) as (key: keyof Dictionary, params?: Record<string, string | number | boolean>) => string

export { globalLocale }

export const { use: useLanguage, provider: LanguageProvider } = createSimpleContext({
  name: "Language",
  init: () => {
    const kv = useKV()
    const config = useTuiConfig()

    const initial = normalizeLocale(config.language ?? kv.get("language"))
    setGlobalLocale(initial)

    const locale = createMemo<Locale>(() => globalLocale())

    return {
      locale,
      locales: LOCALES,
      t: translate,
      setLocale(next: Locale) {
        const value = normalizeLocale(next)
        setGlobalLocale(value)
        kv.set("language", value)
      },
    }
  },
})
