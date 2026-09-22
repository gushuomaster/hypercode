import { describe, expect, test } from "bun:test"
import { getLocale, normalizeLocale, setLocale, t } from "../../src/i18n"
import { dict as en } from "../../src/i18n/en"
import { dict as zh } from "../../src/i18n/zh"

describe("locale core", () => {
  test("keeps Chinese and English dictionary keys aligned", () => {
    expect(Object.keys(zh).sort()).toEqual(Object.keys(en).sort())
  })

  test("detects only Chinese environments as Chinese", () => {
    expect(normalizeLocale(undefined, { LANG: "zh_CN.UTF-8" })).toBe("zh")
    expect(normalizeLocale(undefined, { LC_ALL: "zh_TW.UTF-8" })).toBe("zh")
    expect(normalizeLocale(undefined, { LANGUAGE: "en_US.UTF-8" })).toBe("en")
    expect(normalizeLocale(undefined, { LANG: "ja_JP.UTF-8" })).toBe("en")
    expect(normalizeLocale(undefined, {})).toBe("en")
  })

  test("keeps an explicit supported locale", () => {
    expect(normalizeLocale("zh", { LANG: "en_US.UTF-8" })).toBe("zh")
    expect(normalizeLocale("en", { LANG: "zh_CN.UTF-8" })).toBe("en")
  })

  test("switches translations through shared state", () => {
    setLocale("zh")
    expect(getLocale()).toBe("zh")
    expect(t("dialog.select.search")).toBe("搜索")

    setLocale("en")
    expect(getLocale()).toBe("en")
    expect(t("dialog.select.search")).toBe("Search")
  })
})
