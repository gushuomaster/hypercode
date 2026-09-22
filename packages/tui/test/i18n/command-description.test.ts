import { describe, expect, test } from "bun:test"
import { commandSourceLabel, localizedDescription } from "../../src/i18n"

describe("command descriptions", () => {
  test("uses the selected locale before the legacy description", () => {
    const command = {
      description: "Legacy description",
      description_i18n: {
        zh: "中文介绍",
        en: "English description",
      },
    }

    expect(localizedDescription(command, "zh")).toBe("中文介绍")
    expect(localizedDescription(command, "en")).toBe("English description")
  })

  test("falls back to the legacy description", () => {
    expect(localizedDescription({ description: "External author copy" }, "zh")).toBe("External author copy")
    expect(localizedDescription({}, "en")).toBeUndefined()
  })

  test("localizes source labels without changing technical terms", () => {
    expect(commandSourceLabel({ source: "mcp" }, "zh")).toBe("MCP")
    expect(commandSourceLabel({ source: "skill" }, "zh")).toBe("Skill")
    expect(commandSourceLabel({ source: "command", description_i18n: { zh: "内置命令" } }, "zh")).toBe("命令")
    expect(commandSourceLabel({ source: "command" }, "zh")).toBe("自定义")
    expect(commandSourceLabel({ source: "command", description_i18n: { en: "Built-in command" } }, "en")).toBe(
      "Command",
    )
    expect(commandSourceLabel({ source: "command" }, "en")).toBe("Custom")
  })
})
