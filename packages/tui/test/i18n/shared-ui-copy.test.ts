import { describe, expect, test } from "bun:test"
import { agentDisplayName, t } from "../../src/i18n"

describe("shared UI copy", () => {
  test("localizes built-in agent display names without changing custom names", () => {
    expect(agentDisplayName("build", "zh")).toBe("执行")
    expect(agentDisplayName("plan", "zh")).toBe("规划")
    expect(agentDisplayName("build", "en")).toBe("Build")
    expect(agentDisplayName("plan", "en")).toBe("Plan")
    expect(agentDisplayName("code-reviewer", "zh")).toBe("code-reviewer")
  })

  test("localizes shared selector copy", () => {
    expect(t("dialog.select.search", undefined, "zh")).toBe("搜索")
    expect(t("dialog.select.noResults", undefined, "zh")).toBe("未找到结果")
    expect(t("dialog.select.search", undefined, "en")).toBe("Search")
    expect(t("dialog.select.noResults", undefined, "en")).toBe("No results found")
  })
})
