import { describe, expect, test } from "bun:test"
import { EN, ZH, getLocale, localizedCommandDescription, normalizeLocale, setLocale, t } from "../i18n"

describe("VS Code localization", () => {
  test("normalizes every Chinese VS Code locale to simplified Chinese", () => {
    expect(normalizeLocale("zh-cn")).toBe("zh")
    expect(normalizeLocale("zh-TW")).toBe("zh")
    expect(normalizeLocale("en-US")).toBe("en")
    expect(normalizeLocale(undefined)).toBe("en")
  })

  test("keeps English and Chinese dictionary keys identical", () => {
    expect(Object.keys(ZH).sort()).toEqual(Object.keys(EN).sort())
  })

  test("switches locale and interpolates named parameters", () => {
    setLocale("zh-CN")
    expect(getLocale()).toBe("zh")
    expect(t("runtime.available", { host: "local", output: "1.18.30" })).toBe(
      "HyperCode 运行时在当前 local 主机上可用：1.18.30",
    )

    setLocale("en")
    expect(t("runtime.available", { host: "local", output: "1.18.30" })).toBe(
      "HyperCode runtime is available on the current local host: 1.18.30",
    )
  })

  test("selects localized command descriptions and falls back to legacy text", () => {
    const command = {
      description: "Legacy description",
      description_i18n: {
        zh: "中文介绍",
        en: "English description",
      },
    }

    expect(localizedCommandDescription(command, "zh")).toBe("中文介绍")
    expect(localizedCommandDescription(command, "en")).toBe("English description")
    expect(localizedCommandDescription({ description: "Legacy description" }, "zh")).toBe("Legacy description")
  })
})
