import { createMemo, createSignal } from "solid-js"
import { createSimpleContext } from "./helper"
import { useKV } from "./kv"
import { useTuiConfig } from "../config"
import {
  getLocale,
  LOCALES,
  normalizeLocale,
  setLocale as setSharedLocale,
  t,
  type Locale,
} from "../i18n"

export { LOCALES, normalizeLocale, type Locale }

// 模块级全局 locale,供非组件上下文(如内置插件注册命令时)使用。
// LanguageProvider 初始化和 setLocale 时同步更新它。
const [globalLocale, setGlobalLocale] = createSignal<Locale>(getLocale())

// 独立的翻译函数,读取全局 locale,可在任意位置调用(包括插件初始化)。
// 在响应式作用域里通过 getter 调用即可随语言切换刷新。
export const translate = ((key, params) => t(key, params, globalLocale())) as typeof t

export { globalLocale }

export const { use: useLanguage, provider: LanguageProvider } = createSimpleContext({
  name: "Language",
  init: () => {
    const kv = useKV()
    const config = useTuiConfig()

    const initial = normalizeLocale(config.language ?? kv.get("language"))
    setGlobalLocale(initial)
    setSharedLocale(initial)

    const locale = createMemo<Locale>(() => globalLocale())

    return {
      locale,
      locales: LOCALES,
      t: translate,
      setLocale(next: Locale) {
        const value = normalizeLocale(next)
        setGlobalLocale(value)
        setSharedLocale(value)
        kv.set("language", value)
      },
    }
  },
})
